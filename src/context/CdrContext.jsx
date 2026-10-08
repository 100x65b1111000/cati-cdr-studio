import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import Papa from 'papaparse';
import { DEFAULT_EXT_MAP, DEFAULT_SHIFT_CONFIG } from '../constants/defaultData';
import { DEFAULT_DATE_RANGE } from '../utils/dateRange';
import { loadFromStorage, saveToStorage } from '../utils/storage';
import { parseRawCallRecords, calculateShiftAnalysis } from '../services/shiftCalculator';
import { generateDemoCDRData } from '../services/demoDataGenerator';
import { COLOR_SCHEMES, DEFAULT_SCHEME, cssVarName, hexToRgbTriplet } from '../theme/colorSchemes';

const CdrContext = createContext(null);

export function CdrProvider({ children }) {
  // 1. Persistent State
  const [extNameMap, setExtNameMap] = useState(() =>
    loadFromStorage('ext_map', DEFAULT_EXT_MAP)
  );

  const [colorScheme, setColorScheme] = useState(() => {
    const saved = loadFromStorage('color_scheme', DEFAULT_SCHEME);
    return COLOR_SCHEMES[saved] ? saved : DEFAULT_SCHEME;
  });

  const [shiftConfig, setShiftConfig] = useState(() => 
    loadFromStorage('shift_config', DEFAULT_SHIFT_CONFIG)
  );

  const [manualOverrides, setManualOverrides] = useState(() =>
    loadFromStorage('manual_overrides', {})
  );

  const [dateRange, setDateRange] = useState(() =>
    loadFromStorage('date_range', DEFAULT_DATE_RANGE)
  );

  const [savedViews, setSavedViews] = useState(() => loadFromStorage('saved_views', []));

  // 2. Runtime State
  const [rawRecords, setRawRecords] = useState([]);
  const [activeTab, setActiveTab] = useState('rundown');
  const [toasts, setToasts] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddAgentOpen, setIsAddAgentOpen] = useState(false);
  const [pendingUpload, setPendingUpload] = useState(null); // { fileName, rows }
  const [selectedAgentDetail, setSelectedAgentDetail] = useState(null); // { ext, dateStr }

  // 3. Toast Notifications
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substring(2, 7);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3200);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // 4. Update and Persist Effects
  useEffect(() => {
    saveToStorage('ext_map', extNameMap);
  }, [extNameMap]);

  useEffect(() => {
    saveToStorage('shift_config', shiftConfig);
  }, [shiftConfig]);

  // Apply the active color scheme as CSS variables on <html> and persist it
  useEffect(() => {
    const root = document.documentElement;
    const colors = COLOR_SCHEMES[colorScheme].colors;
    for (const [role, hex] of Object.entries(colors)) {
      root.style.setProperty(cssVarName(role), hexToRgbTriplet(hex));
    }
    saveToStorage('color_scheme', colorScheme);
  }, [colorScheme]);

  useEffect(() => {
    saveToStorage('manual_overrides', manualOverrides);
  }, [manualOverrides]);

  useEffect(() => {
    saveToStorage('date_range', dateRange);
  }, [dateRange]);

  useEffect(() => {
    saveToStorage('saved_views', savedViews);
  }, [savedViews]);

  useEffect(() => {
    if (rawRecords && rawRecords.length > 0) {
      saveToStorage('raw_records', rawRecords);
    }
  }, [rawRecords]);

  // 5. Parse calls whenever rawRecords change (derived, avoids an extra render cycle)
  const rawCalls = useMemo(() => {
    if (!rawRecords || rawRecords.length === 0) return [];
    return parseRawCallRecords(rawRecords);
  }, [rawRecords]);

  // 6. Recalculate analysis when calls, extNameMap, shiftConfig, or manualOverrides change
  const analysis = useMemo(() => {
    if (!rawCalls || rawCalls.length === 0) return {};
    return calculateShiftAnalysis(rawCalls, extNameMap, shiftConfig, manualOverrides);
  }, [rawCalls, extNameMap, shiftConfig, manualOverrides]);

  // 7. Initial startup: load saved records or generate demo data
  useEffect(() => {
    const saved = loadFromStorage('raw_records', null);
    if (saved && saved.length > 0) {
      setRawRecords(saved);
    } else {
      const demo = generateDemoCDRData(extNameMap);
      setRawRecords(demo);
    }
  }, []);

  // 8. Actions
  const loadDemoData = useCallback(() => {
    const demo = generateDemoCDRData(extNameMap);
    setRawRecords(demo);
    // A new dataset replaces the old one, so a saved range preset would hide it.
    setDateRange(DEFAULT_DATE_RANGE);
    addToast("Demo CDR dataset loaded!", "success");
  }, [extNameMap, addToast]);

  const handleFileDropOrSelect = useCallback((file) => {
    if (!file) return;
    setParseError('');
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseError('That file is not a CSV. Export the CDR report as .csv and try again.');
      return;
    }

    setIsParsing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        setIsParsing(false);
        if (results.data && results.data.length > 0) {
          setPendingUpload({
            fileName: file.name,
            rows: results.data
          });
        } else {
          setParseError(`${file.name} parsed but contained no rows.`);
        }
      },
      error: function(err) {
        setIsParsing(false);
        setParseError(`CSV parse failed: ${err.message}`);
      }
    });
  }, []);

  const confirmPendingUpload = useCallback(() => {
    if (pendingUpload && pendingUpload.rows.length > 0) {
      setRawRecords(pendingUpload.rows);
      setDateRange(DEFAULT_DATE_RANGE);
      addToast(`Generated Rundown Report for ${pendingUpload.rows.length} CDR records!`, "success");
      setPendingUpload(null);
    }
  }, [pendingUpload, addToast]);

  const cancelPendingUpload = useCallback(() => {
    setPendingUpload(null);
  }, []);

  const updateManualOverride = useCallback((ext, dateStr, field, value) => {
    const key = `${ext}_${dateStr}`;
    setManualOverrides(prev => {
      const current = prev[key]?.[field];
      if (current === value) return prev;
      return {
        ...prev,
        [key]: {
          ...(prev[key] || { halfDones: 0, surveys: 0 }),
          [field]: value
        }
      };
    });
  }, []);

  const updateExtMapping = useCallback((ext, name) => {
    setExtNameMap(prev => ({
      ...prev,
      [ext]: name.trim()
    }));
    addToast(`Updated Agent Name for Extension ${ext}`, 'success');
  }, [addToast]);

  const removeExtMapping = useCallback((ext) => {
    setExtNameMap(prev => {
      const copy = { ...prev };
      delete copy[ext];
      return copy;
    });
    addToast(`Removed extension ${ext} mapping`, 'info');
  }, [addToast]);

  const updateShiftConfig = useCallback((newConfig) => {
    const timingChanged =
      newConfig.shiftStartDay !== shiftConfig.shiftStartDay ||
      newConfig.shiftStartTime !== shiftConfig.shiftStartTime ||
      newConfig.shiftEndDay !== shiftConfig.shiftEndDay ||
      newConfig.shiftEndTime !== shiftConfig.shiftEndTime;
    const thresholdChanged =
      newConfig.breakThresholdMinutes !== shiftConfig.breakThresholdMinutes;

    setShiftConfig(newConfig);

    if (timingChanged) {
      const rollDays = newConfig.shiftEndDay - newConfig.shiftStartDay;
      addToast(`Shift updated: Day ${newConfig.shiftStartDay + 1} ${newConfig.shiftStartTime} to Day ${newConfig.shiftEndDay + 1} ${newConfig.shiftEndTime} (Rollover: +${rollDays}d)`, 'info');
    } else if (thresholdChanged) {
      addToast(`Break threshold updated to ${newConfig.breakThresholdMinutes} min. Rundown recalculated.`, 'info');
    } else {
      addToast('Shift settings saved.', 'info');
    }
  }, [shiftConfig, addToast]);

  const addSavedView = useCallback((name, filters) => {
    const view = {
      id: Date.now().toString(36),
      name: name.trim(),
      createdAt: new Date().toISOString().slice(0, 10),
      filters
    };
    setSavedViews(prev => [...prev, view]);
    addToast(`View "${view.name}" saved`, 'success');
    return view;
  }, [addToast]);

  const replaceSavedView = useCallback((id, filters) => {
    setSavedViews(prev => prev.map(v => (v.id === id ? { ...v, filters } : v)));
  }, []);

  const deleteSavedView = useCallback((id) => {
    setSavedViews(prev => prev.filter(v => v.id !== id));
  }, []);

  const clearParseError = useCallback(() => setParseError(''), []);

  const value = {
    // Data
    extNameMap,
    shiftConfig,
    manualOverrides,
    rawRecords,
    rawCalls,
    analysis,
    dateRange,
    setDateRange,
    savedViews,
    addSavedView,
    replaceSavedView,
    deleteSavedView,
    activeTab,
    setActiveTab,
    colorScheme,
    setColorScheme,
    isParsing,
    parseError,
    clearParseError,
    toasts,
    addToast,
    removeToast,

    // Modals
    isSettingsOpen,
    setIsSettingsOpen,
    isAddAgentOpen,
    setIsAddAgentOpen,
    pendingUpload,
    selectedAgentDetail,
    setSelectedAgentDetail,

    // Operations
    loadDemoData,
    handleFileDropOrSelect,
    confirmPendingUpload,
    cancelPendingUpload,
    updateManualOverride,
    updateExtMapping,
    removeExtMapping,
    updateShiftConfig
  };

  return (
    <CdrContext.Provider value={value}>
      {children}
    </CdrContext.Provider>
  );
}

export function useCdr() {
  const context = useContext(CdrContext);
  if (!context) {
    throw new Error('useCdr must be used within a CdrProvider');
  }
  return context;
}
