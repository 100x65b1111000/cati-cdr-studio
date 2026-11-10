import React, { createContext, useContext, useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import Papa from 'papaparse';
import { usePathname, useRouter } from 'next/navigation';
import { DEFAULT_EXT_MAP, DEFAULT_SHIFT_CONFIG } from '../constants/defaultData';
import { DEFAULT_DATE_RANGE } from '../utils/dateRange';
import { loadFromStorage, saveToStorage, removeFromStorage } from '../utils/storage';
import { reducedMotion } from '../utils/motion';
import { parseRawCallRecords, calculateShiftAnalysis } from '../services/shiftCalculator';
import { COLOR_MODES, DEFAULT_MODE, cssVarName, getMode, hexToRgbTriplet } from '../theme/colorSchemes';
import { NAV } from '../components/layout/navConfig';
import { generateDemoCDRData } from '../services/demoDataGenerator';

const CdrContext = createContext(null);

function buildDemoDataset(extMap) {
  const extensions = Object.keys(extMap && Object.keys(extMap).length > 0 ? extMap : DEFAULT_EXT_MAP)
    .filter((e) => !e.startsWith('10404'));
  const roster = Object.fromEntries(extensions.map((ext) => [ext, ext]));
  const rows = generateDemoCDRData(roster);
  return {
    upload: {
      id: Date.now(),
      filename: 'sample.cdr.csv',
      source: 'demo',
      rowCount: rows.length,
      uploadedAt: new Date().toISOString()
    },
    rows,
    history: []
  };
}

export function CdrProvider({ children }) {
  // 1. Persistent State
  const [extNameMap, setExtNameMap] = useState(() => {
    const saved = loadFromStorage('ext_map', null);
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      return saved;
    }
    return DEFAULT_EXT_MAP;
  });

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

  // 'system' follows the OS. 'full' is for a person whose Windows animation effects are
  // off but who still wants to see a view switch: under `prefers-reduced-motion` both
  // index.css and animate.css clamp every ramp to about 1ms, which is one displaced frame
  // rather than a transition. `data-motion` is the only thing that lifts those clamps.
  const [motion, setMotion] = useState(() =>
    loadFromStorage('motion', null) === 'full' ? 'full' : 'system'
  );

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
  const [datasetState, setDatasetState] = useState(() => {
    const saved = loadFromStorage('dataset', null);
    if (saved && Array.isArray(saved.rows) && saved.rows.length > 0) {
      return saved;
    }
    return buildDemoDataset(DEFAULT_EXT_MAP);
  });
  const rawRecords = datasetState.rows || [];
  const activeUpload = datasetState.upload || null;
  const uploadHistory = datasetState.history || [];
  // The URL is the view, so a back button, a shared link and a hotkey all do one thing.
  const router = useRouter();
  const activeTab = usePathname().split('/')[1] || 'rundown';
  const setActiveTab = useCallback((id) => router.push(`/${id}`), [router]);
  // Which way the incoming page travels: forward through the rail lifts it from below,
  // back through the rail drops it from above. Cached against the tab it describes, so a
  // re-render for an unrelated reason cannot change the animation name mid-flight and
  // restart the sweep from the other side.
  const slide = useRef({ tab: activeTab, cls: 'animate__slideInUp' });
  if (slide.current.tab !== activeTab) {
    const rank = (id) => NAV.findIndex((v) => v.id === id);
    slide.current = {
      tab: activeTab,
      cls: rank(activeTab) > rank(slide.current.tab) ? 'animate__slideInUp' : 'animate__slideInDown'
    };
  }

  // A view arriving on a sweep is a transform, and a transform's overflow is scrollable
  // overflow: for the length of the ramp the document grows by the whole sweep, so a
  // scrollbar flashes in and the page can be scrolled into blank space. Clipping `main` all
  // the time would cut off every page taller than the window, so the clip exists only for
  // the ramp — and not at all under reduced motion, where the ramp is a single frame and a
  // clip would only blink the bottom of a long page off.
  // Layout, not passive: the first painted frame is the most displaced one.
  useLayoutEffect(() => {
    const el = document.querySelector('main');
    if (!el || reducedMotion()) return;
    // On with the switch, not with the first animation frame: `animationstart` is a frame
    // late, and by then the displaced page has already grown the document, the browser has
    // clamped the scroll offset to it, and the sticky app bar has ridden that up out of the
    // window. Off with the ramp — only its own two names, so a popover or a toast
    // animating inside the view cannot take the clip off early.
    el.style.overflow = 'clip';
    const end = (e) => {
      if (e.animationName === 'slideInUp' || e.animationName === 'slideInDown') el.style.overflow = '';
    };
    el.addEventListener('animationend', end);
    return () => {
      el.removeEventListener('animationend', end);
      el.style.overflow = '';
    };
  }, [activeTab]);
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

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (motion === 'full') root.dataset.motion = 'full';
    else delete root.dataset.motion;
    saveToStorage('motion', motion);
  }, [motion]);

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

  // Auto-populate extension mappings from the active CDR report with empty mappings
  useEffect(() => {
    if (!rawCalls || rawCalls.length === 0) return;
    const seenExts = new Set(rawCalls.map((c) => c.extension).filter(Boolean));
    if (seenExts.size === 0) return;

    setExtNameMap((prev) => {
      const base = { ...prev };
      let changed = false;

      // When the report contains real non-demo extensions, clean out unused sample demo defaults
      const isDemoReport = Array.from(seenExts).every((e) => e in DEFAULT_EXT_MAP);
      if (!isDemoReport) {
        for (const demoExt of Object.keys(DEFAULT_EXT_MAP)) {
          if (!seenExts.has(demoExt) && base[demoExt] === DEFAULT_EXT_MAP[demoExt]) {
            delete base[demoExt];
            changed = true;
          }
        }
      }

      // Add any extension from the CDR report that isn't mapped yet
      for (const ext of seenExts) {
        if (!(ext in base)) {
          base[ext] = '';
          changed = true;
        }
      }

      return changed ? base : prev;
    });
  }, [rawCalls]);

  // 7. Dataset management (In-browser storage for static deployment)
  const applyDataset = useCallback((dataset) => {
    setDatasetState(dataset);
  }, []);

  const resetToDemoData = useCallback(() => {
    setIsParsing(true);
    try {
      const demo = buildDemoDataset(extNameMap);
      applyDataset(demo);
      saveToStorage('dataset', demo);
      setDateRange(DEFAULT_DATE_RANGE);
      addToast('Loaded synthetic CATI team sample data.', 'info');
    } catch (err) {
      setParseError(err.message);
    } finally {
      setIsParsing(false);
    }
  }, [extNameMap, applyDataset, addToast]);

  // 8. Actions
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

  const confirmPendingUpload = useCallback(() => {
    if (!pendingUpload?.rows) return;
    setIsParsing(true);
    try {
      const newUpload = {
        id: Date.now(),
        filename: pendingUpload.fileName,
        source: 'upload',
        rowCount: pendingUpload.rows.length,
        uploadedAt: new Date().toISOString()
      };

      const previousEntry = activeUpload
        ? {
            id: activeUpload.id,
            filename: activeUpload.filename,
            source: activeUpload.source,
            rowCount: activeUpload.rowCount,
            uploadedAt: activeUpload.uploadedAt
          }
        : null;

      const newHistory = previousEntry
        ? [previousEntry, ...uploadHistory.filter((u) => u.id !== previousEntry.id)].slice(0, 5)
        : uploadHistory;

      const newDataset = {
        upload: newUpload,
        rows: pendingUpload.rows,
        history: newHistory
      };

      applyDataset(newDataset);
      saveToStorage('dataset', newDataset);

      // Auto-populate empty mappings for new extensions and purge unused demo defaults
      const seenExts = new Set(
        parseRawCallRecords(pendingUpload.rows).map((c) => c.extension).filter(Boolean)
      );
      setExtNameMap((prev) => {
        const updated = { ...prev };
        for (const demoExt of Object.keys(DEFAULT_EXT_MAP)) {
          if (!seenExts.has(demoExt) && updated[demoExt] === DEFAULT_EXT_MAP[demoExt]) {
            delete updated[demoExt];
          }
        }
        for (const ext of seenExts) {
          if (!(ext in updated)) {
            updated[ext] = '';
          }
        }
        saveToStorage('ext_map', updated);
        return updated;
      });

      setDateRange(DEFAULT_DATE_RANGE);
      addToast(`Generated Rundown Report for ${pendingUpload.rows.length} CDR records!`, 'success');
      setPendingUpload(null);
    } catch (err) {
      setParseError(err.message);
    } finally {
      setIsParsing(false);
    }
  }, [pendingUpload, activeUpload, uploadHistory, applyDataset, addToast]);

  const restoreUpload = useCallback((id) => {
    setIsParsing(true);
    try {
      const target = uploadHistory.find((u) => u.id === id);
      if (!target || !target.rows) {
        throw new Error('Upload data not found in browser history.');
      }
      const previousEntry = activeUpload ? { ...activeUpload, rows: rawRecords } : null;
      const newHistory = previousEntry
        ? [previousEntry, ...uploadHistory.filter((u) => u.id !== id)].slice(0, 5)
        : uploadHistory.filter((u) => u.id !== id);

      const restoredDataset = {
        upload: {
          id: target.id,
          filename: target.filename,
          source: target.source,
          rowCount: target.rowCount,
          uploadedAt: target.uploadedAt
        },
        rows: target.rows,
        history: newHistory
      };

      applyDataset(restoredDataset);
      saveToStorage('dataset', restoredDataset);
      setDateRange(DEFAULT_DATE_RANGE);
      addToast(`Previous upload "${target.filename}" restored.`, 'success');
    } catch (err) {
      setParseError(err.message);
    } finally {
      setIsParsing(false);
    }
  }, [activeUpload, rawRecords, uploadHistory, applyDataset, addToast]);

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

  // The rundown writes a value; Settings is the only place that can take one back off,
  // because a typed half-done silently moves every total on the analytics view.
  const clearManualOverride = useCallback((ext, dateStr) => {
    const key = `${ext}_${dateStr}`;
    setManualOverrides(prev => {
      if (!(key in prev)) return prev;
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    addToast(`Cleared the typed values for extension ${ext} on ${dateStr}`, 'info');
  }, [addToast]);

  const updateExtMapping = useCallback((ext, name) => {
    const trimmed = (name || '').trim();
    setExtNameMap(prev => {
      const updated = {
        ...prev,
        [ext]: trimmed
      };
      saveToStorage('ext_map', updated);
      return updated;
    });
    addToast(trimmed ? `Mapped Extension ${ext} to ${trimmed}` : `Cleared custom name for Extension ${ext}`, 'success');
  }, [addToast]);

  const removeExtMapping = useCallback(
    (ext) => {
      const hasCalls = rawCalls.some((c) => c.extension === ext);
      if (hasCalls) {
        if (!extNameMap[ext]) {
          addToast(`Extension ${ext} has calls in this report with no custom name assigned`, 'info');
          return;
        }
        setExtNameMap((prev) => ({
          ...prev,
          [ext]: ''
        }));
        addToast(`Cleared custom name for extension ${ext}`, 'info');
      } else {
        setExtNameMap((prev) => {
          const copy = { ...prev };
          delete copy[ext];
          return copy;
        });
        addToast(`Removed extension ${ext} mapping`, 'info');
      }
    },
    [rawCalls, extNameMap, addToast]
  );

  const resetExtMappings = useCallback(() => {
    if (activeUpload?.source === 'demo') {
      setExtNameMap(DEFAULT_EXT_MAP);
      addToast('Reset agent mappings to demo defaults', 'info');
    } else {
      const seenExts = [...new Set(rawCalls.map((c) => c.extension).filter(Boolean))];
      const emptyMap = Object.fromEntries(seenExts.map((ext) => [ext, '']));
      setExtNameMap(emptyMap);
      addToast(`Reset ${seenExts.length} extensions from report to empty mappings`, 'info');
    }
  }, [activeUpload?.source, rawCalls, addToast]);

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
    slide: slide.current.cls,
    colorScheme,
    setColorScheme,
    motion,
    setMotion,
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
    handleFileDropOrSelect,
    confirmPendingUpload,
    cancelPendingUpload,
    resetToDemoData,
    updateManualOverride,
    clearManualOverride,
    updateExtMapping,
    removeExtMapping,
    resetExtMappings,
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
