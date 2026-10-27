import React, { createContext, useContext, useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import Papa from 'papaparse';
import { usePathname, useRouter } from 'next/navigation';
import { DEFAULT_EXT_MAP, DEFAULT_SHIFT_CONFIG } from '../constants/defaultData';
import { DEFAULT_DATE_RANGE } from '../utils/dateRange';
import { loadFromStorage, saveToStorage, removeFromStorage } from '../utils/storage';
import { parseRawCallRecords, calculateShiftAnalysis } from '../services/shiftCalculator';
import { COLOR_MODES, DEFAULT_MODE, cssVarName, getMode, hexToRgbTriplet } from '../theme/colorSchemes';

const CdrContext = createContext(null);

// Records live on the server now. Every route that changes them answers with the new
// dataset, so one helper covers fetch, upload, sample data and restore.
async function api(url, init) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `The server replied ${res.status}.`);
  return data;
}

const demoRequest = (extensions) =>
  api('/api/calls/demo', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ extensions })
  });

export function CdrProvider({ children }) {
  // 1. Persistent State
  const [extNameMap, setExtNameMap] = useState(() =>
    loadFromStorage('ext_map', DEFAULT_EXT_MAP)
  );

  // Named `colorScheme` rather than `colorMode` because AnalyticsView lists it in a
  // useMemo dependency, and that dependency is what repaints the chart canvases when
  // the mode changes. The value it holds is a mode id.
  const [colorScheme, setColorScheme] = useState(() => {
    const saved = loadFromStorage('color_mode', null);
    if (COLOR_MODES[saved]) return saved;
    // `color_scheme` is the retired key, and it only ever held one of five ids whose
    // surfaces were all dark, so mapping any value to `dark` loses nothing.
    if (loadFromStorage('color_scheme', null) !== null) {
      removeFromStorage('color_scheme');
      return 'dark';
    }
    // Nothing stored: a phone floor runs in daylight, so the OS decides.
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : DEFAULT_MODE;
  });

  // The mode to hand back when the print dialog closes. A ref, not state: it must
  // outlive the re-render that the print flip itself causes.
  const printRestore = useRef(null);

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
  const [activeUpload, setActiveUpload] = useState(null);
  const [uploadHistory, setUploadHistory] = useState([]);
  // The URL is the view, so a back button, a shared link and a hotkey all do one thing.
  const router = useRouter();
  const activeTab = usePathname().split('/')[1] || 'rundown';
  const setActiveTab = useCallback((id) => router.push(`/${id}`), [router]);
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

  // Apply the active mode as CSS variables on <html> and persist it. Layout effect, not
  // effect: a deferred write means the first paint of the whole UI resolves every k-*
  // token against Tailwind's dark fallbacks, and a light-mode user watches a dark frame
  // flip. The write stays inline on the element rather than moving into a CSS rule —
  // that is what lets the print overrides win with !important, and what ui-check mutates.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const colors = getMode(colorScheme).colors;
    for (const [role, hex] of Object.entries(colors)) {
      root.style.setProperty(cssVarName(role), hexToRgbTriplet(hex));
    }
    root.setAttribute('data-mode', colorScheme);
    saveToStorage('color_mode', colorScheme);
  }, [colorScheme]);

  // A <canvas> is a bitmap: themeColor() bakes the on-screen palette into its pixels at
  // render time, so no print stylesheet can reach it — printing from dark mode put dark
  // chart plates on white paper. Flipping the mode is the only lever that repaints them,
  // because AnalyticsView's useMemo lists colorScheme as a dependency.
  // beforeprint/afterprint is the standard path; the matchMedia listener is what a
  // headless print emulation drives, and the guard keeps the two from overwriting the
  // stored mode with 'light' when both fire.
  useEffect(() => {
    const mq = window.matchMedia('print');
    const set = (printing) => {
      if (printing) {
        if (printRestore.current === null) printRestore.current = colorScheme;
        setColorScheme('light');
      } else if (printRestore.current !== null) {
        setColorScheme(printRestore.current);
        printRestore.current = null;
      }
    };
    const onBefore = () => set(true);
    const onAfter = () => set(false);
    const onChange = (e) => set(e.matches);
    window.addEventListener('beforeprint', onBefore);
    window.addEventListener('afterprint', onAfter);
    mq.addEventListener('change', onChange);
    return () => {
      window.removeEventListener('beforeprint', onBefore);
      window.removeEventListener('afterprint', onAfter);
      mq.removeEventListener('change', onChange);
    };
  }, [colorScheme]);

  useEffect(() => {
    saveToStorage('manual_overrides', manualOverrides);
  }, [manualOverrides]);  useEffect(() => {
    saveToStorage('date_range', dateRange);
  }, [dateRange]);

  useEffect(() => {
    saveToStorage('saved_views', savedViews);
  }, [savedViews]);

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

  // 7. Dataset from the server
  const applyDataset = useCallback((dataset) => {
    setRawRecords(dataset.rows || []);
    setActiveUpload(dataset.upload || null);
    setUploadHistory(dataset.history || []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Retired key: the records are shared now, so a browser copy is stale by definition.
    removeFromStorage('raw_records');
    setIsParsing(true);
    (async () => {
      try {
        let dataset = await api('/api/calls');
        // An empty server seeds the sample, so a first run still shows something. The
        // roster read here is this browser's stored one, which is who the sample is for.
        if (dataset.rows.length === 0) dataset = await demoRequest(Object.keys(extNameMap));
        if (!cancelled) applyDataset(dataset);
      } catch (err) {
        if (!cancelled) setParseError(err.message);
      } finally {
        if (!cancelled) setIsParsing(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot only
  }, []);

  // 8. Actions
  const loadDemoData = useCallback(async () => {
    setIsParsing(true);
    try {
      applyDataset(await demoRequest(Object.keys(extNameMap)));
      // A new dataset replaces the old one, so a saved range preset would hide it.
      setDateRange(DEFAULT_DATE_RANGE);
      addToast('Demo CDR dataset loaded!', 'success');
    } catch (err) {
      setParseError(err.message);
    } finally {
      setIsParsing(false);
    }
  }, [extNameMap, applyDataset, addToast]);

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
          // The File is kept for the confirm step: the server does the storing, and
          // re-parsing here is only so the preview can show the count first.
          setPendingUpload({
            file,
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

  const confirmPendingUpload = useCallback(async () => {
    if (!pendingUpload?.file) return;
    const form = new FormData();
    form.append('file', pendingUpload.file);
    setIsParsing(true);
    try {
      applyDataset(await api('/api/calls', { method: 'POST', body: form }));
      setDateRange(DEFAULT_DATE_RANGE);
      addToast(`Generated Rundown Report for ${pendingUpload.rows.length} CDR records!`, 'success');
      setPendingUpload(null);
    } catch (err) {
      setParseError(err.message);
    } finally {
      setIsParsing(false);
    }
  }, [pendingUpload, applyDataset, addToast]);

  const restoreUpload = useCallback(async (id) => {
    setIsParsing(true);
    try {
      applyDataset(await api('/api/calls/restore', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id })
      }));
      setDateRange(DEFAULT_DATE_RANGE);
      addToast('Previous upload restored.', 'success');
    } catch (err) {
      setParseError(err.message);
    } finally {
      setIsParsing(false);
    }
  }, [applyDataset, addToast]);

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
    activeUpload,
    uploadHistory,
    restoreUpload,
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
