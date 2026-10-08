import React, { useEffect, useState } from 'react';
import {
  BracketsCurly,
  Columns,
  FileCsv,
  FileXls,
  FloppyDisk,
  Printer,
  Timer,
  Trash,
  UserFocus
} from '@phosphor-icons/react';
import { useCdr } from '../../context/CdrContext';
import { DEFAULT_SHIFT_CONFIG } from '../../constants/defaultData';
import { exportRundownToExcel, exportRundownToCSV, exportAnalysisToJSON } from '../../services/exportService';
import FilterPopover from '../ui/FilterPopover';
import SearchInput from '../ui/SearchInput';
import Segmented from '../ui/Segmented';
import { COLUMN_BY_ID } from './columns';

const menuItem =
  'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-k-ink transition-colors hover:bg-k-surface-hover';

function Checkbox({ checked, onChange, children }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs text-k-ink hover:bg-k-surface">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 accent-k-accent"
      />
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
    </label>
  );
}

export default function RundownToolbar({
  searchQuery,
  setSearchQuery,
  selectedExtensions,
  setSelectedExtensions,
  availableExtensions,
  visibleColumns,
  setVisibleColumns,
  connView,
  setConnView,
  filters,
  onApplyFilters,
  rows
}) {
  const {
    extNameMap,
    shiftConfig,
    updateShiftConfig,
    analysis,
    addToast,
    savedViews,
    addSavedView,
    replaceSavedView,
    deleteSavedView
  } = useCdr();

  const [extSearch, setExtSearch] = useState('');
  const [threshold, setThreshold] = useState(String(shiftConfig.breakThresholdMinutes ?? DEFAULT_SHIFT_CONFIG.breakThresholdMinutes));
  const [viewName, setViewName] = useState('');

  useEffect(() => {
    setThreshold(String(shiftConfig.breakThresholdMinutes ?? DEFAULT_SHIFT_CONFIG.breakThresholdMinutes));
  }, [shiftConfig.breakThresholdMinutes]);

  const parsedThreshold = parseInt(threshold, 10);
  const thresholdDirty = Number.isFinite(parsedThreshold) && parsedThreshold !== shiftConfig.breakThresholdMinutes;

  const applyThreshold = () => {
    if (!thresholdDirty) return;
    const clamped = Math.min(120, Math.max(1, parsedThreshold));
    updateShiftConfig({ ...shiftConfig, breakThresholdMinutes: clamped });
  };

  const extMatches = availableExtensions.filter((ext) => {
    const q = extSearch.toLowerCase().trim();
    if (!q) return true;
    return ext.toLowerCase().includes(q) || (extNameMap[ext] || '').toLowerCase().includes(q);
  });

  const toggleExtension = (ext) =>
    setSelectedExtensions(
      selectedExtensions.includes(ext)
        ? selectedExtensions.filter((e) => e !== ext)
        : [...selectedExtensions, ext]
    );

  const toggleColumn = (id) => setVisibleColumns({ ...visibleColumns, [id]: !visibleColumns[id] });
  const shownColumns = Object.keys(visibleColumns).filter((id) => visibleColumns[id]).length;

  const saveCurrentView = () => {
    const name = viewName.trim();
    if (!name) {
      addToast('Give the view a name first.', 'error');
      return;
    }
    addSavedView(name, filters);
    setViewName('');
  };

  const exportExcel = async () => {
    if (shownColumns === 0) {
      addToast('Every column is hidden, so there is nothing to export.', 'error');
      return;
    }
    if (rows.length === 0) {
      addToast('No rows match the current filters.', 'error');
      return;
    }
    try {
      await exportRundownToExcel(rows, visibleColumns, connView);
    } catch (err) {
      addToast(`Excel export failed: ${err.message}`, 'error');
    }
  };

  return (
    <div className="no-print panel relative z-30 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2.5">
      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        label="Agent or extension"
        placeholder="Agent or extension"
        className="w-52 flex-none"
        primary
      />

      <FilterPopover
        label="Agents"
        icon={UserFocus}
        badge={`${selectedExtensions.length}/${availableExtensions.length}`}
      >
        <div className="space-y-1.5 p-2">
          <SearchInput value={extSearch} onChange={setExtSearch} label="Filter agents" placeholder="Filter agents" />
          <div className="flex items-center justify-between border-b border-k-hairline px-2 pb-1.5 text-[11px] text-k-ink-muted">
            <button type="button" className="hover:text-k-accent" onClick={() => setSelectedExtensions([...availableExtensions])}>
              All
            </button>
            <button type="button" className="hover:text-k-danger" onClick={() => setSelectedExtensions([])}>
              None
            </button>
          </div>
          <div className="max-h-56 space-y-0.5 overflow-y-auto pr-1">
            {extMatches.length === 0 ? (
              <p className="px-2 py-2 text-[11px] text-k-ink-muted">No agent matches that.</p>
            ) : (
              extMatches.map((ext) => (
                <Checkbox key={ext} checked={selectedExtensions.includes(ext)} onChange={() => toggleExtension(ext)}>
                  <span className="num min-w-[3.75rem] shrink-0">{ext}</span>
                  {extNameMap[ext] && <span className="min-w-0 truncate text-k-ink-muted">{extNameMap[ext]}</span>}
                </Checkbox>
              ))
            )}
          </div>
        </div>
      </FilterPopover>

      <FilterPopover label="Columns" icon={Columns} tone="region" badge={`${shownColumns}/${Object.keys(visibleColumns).length}`}>
        <div className="space-y-0.5 p-2">
          {Object.keys(visibleColumns).map((id) => (
            <Checkbox key={id} checked={!!visibleColumns[id]} onChange={() => toggleColumn(id)}>
              {COLUMN_BY_ID[id]?.label || id}
            </Checkbox>
          ))}
          <p className="px-2 pt-1.5 text-[10px] text-k-ink-muted">
            Excel writes the columns that are visible here.
          </p>
        </div>
      </FilterPopover>

      <Segmented
        label="Call stats view"
        options={[
          { id: 'total', label: 'Total' },
          { id: 'split', label: 'Connected, missed' }
        ]}
        value={connView}
        onChange={setConnView}
      />

      <div
        className={`flex flex-none items-center gap-1.5 rounded-lg bg-k-sunken/80 px-2.5 py-1.5 text-[11px] ring-1 ring-inset transition-colors ${
          thresholdDirty ? 'ring-k-accent/70 text-k-ink' : 'ring-k-hairline-strong/50 text-k-ink-muted'
        }`}
      >
        <Timer size={14} className="text-k-break-time" />
        <span>Break &gt;</span>
        <input
          type="text"
          inputMode="numeric"
          aria-label="Idle break threshold in minutes"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value.replace(/[^\d]/g, ''))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') applyThreshold();
          }}
          onBlur={applyThreshold}
          className="num w-9 rounded-md bg-k-surface/70 px-1 py-0.5 text-right text-k-ink"
        />
        <span>min</span>
      </div>

      {/* Right-aligned: the sidebar costs 240px, so this is the last control
          before the rail wraps and a left-opening panel would run past the edge. */}
      <FilterPopover label="Views" icon={FloppyDisk} tone="throughput" badge={savedViews.length || ''} align="right">
        <div className="space-y-1.5 p-2">
          {savedViews.length === 0 ? (
            <p className="px-2 py-1 text-[11px] text-k-ink-muted">
              No saved views yet. Save the filters, columns and date range you use most.
            </p>
          ) : (
            savedViews.map((view) => (
              <div key={view.id} className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-k-surface">
                <button type="button" className="flex-1 truncate px-1 py-0.5 text-left text-xs text-k-ink hover:text-k-accent" onClick={() => onApplyFilters(view.filters)}>
                  {view.name}
                </button>
                <span className="num text-[10px] text-k-ink-muted">{view.createdAt}</span>
                <button
                  type="button"
                  aria-label={`Overwrite ${view.name} with the current filters`}
                  className="rounded-md p-1 text-k-ink-muted hover:bg-k-surface-hover hover:text-k-ink"
                  onClick={() => {
                    replaceSavedView(view.id, filters);
                    addToast(`View "${view.name}" overwritten`, 'info');
                  }}
                >
                  <FloppyDisk size={13} />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${view.name}`}
                  className="rounded-md p-1 text-k-ink-muted hover:bg-k-surface-hover hover:text-k-critical"
                  onClick={() => deleteSavedView(view.id)}
                >
                  <Trash size={13} />
                </button>
              </div>
            ))
          )}
          <div className="flex items-center gap-1 border-t border-k-hairline pt-1.5">
            <input
              type="text"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveCurrentView();
              }}
              placeholder="Name this view"
              aria-label="New view name"
              className="glass-input min-w-0 flex-1 rounded-lg px-2 py-1 text-xs text-k-ink placeholder:text-k-ink-muted focus:border-k-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={saveCurrentView}
              className="rounded-lg bg-k-accent px-2.5 py-1 text-[11px] font-semibold text-k-accent-ink transition-opacity hover:opacity-90 active:translate-y-[1px]"
            >
              Save
            </button>
          </div>
        </div>
      </FilterPopover>

      <div className="ml-auto flex flex-none items-center gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-k-hairline-strong bg-k-surface-hover/60 px-3 py-1.5 text-xs font-medium text-k-ink-muted transition-colors hover:bg-k-surface-hover hover:text-k-ink active:translate-y-[1px]"
        >
          <Printer size={15} />
          Print
        </button>
        <FilterPopover label="Export" icon={FileXls} tone="success" align="right">
          <div className="p-1">
            <button type="button" className={menuItem} onClick={exportExcel}>
              <FileXls size={15} className="text-k-success" />
              Excel, visible columns
            </button>
            <button
              type="button"
              className={menuItem}
              onClick={() => exportRundownToCSV(analysis, extNameMap)}
            >
              <FileCsv size={15} className="text-k-talk" />
              CSV, every agent-day
            </button>
            <button type="button" className={menuItem} onClick={() => exportAnalysisToJSON(analysis)}>
              <BracketsCurly size={15} className="text-k-throughput" />
              JSON, full calculation
            </button>
          </div>
        </FilterPopover>
      </div>
    </div>
  );
}
