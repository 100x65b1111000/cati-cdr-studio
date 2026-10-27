import React, { useEffect, useState } from 'react';
import {
  BracketsCurly,
  Columns,
  FileCsv,
  FileXls,
  FloppyDisk,
  Printer,
  Timer,
  Trash
} from '@phosphor-icons/react';
import { useCdr } from '../../context/CdrContext';
import { DEFAULT_SHIFT_CONFIG } from '../../constants/defaultData';
import { exportRundownToExcel, exportRundownToCSV, exportAnalysisToJSON } from '../../services/exportService';
import ExtensionFilter, { Checkbox } from '../ui/ExtensionFilter';
import FilterPopover from '../ui/FilterPopover';
import SearchInput from '../ui/SearchInput';
import Segmented from '../ui/Segmented';
import Stepper from '../ui/Stepper';
import { COLUMN_BY_ID, FILTERABLE_COLUMN_IDS } from './columns';

const menuItem =
  'hoverable flex w-full items-center gap-2 rounded-md border border-transparent px-2.5 py-1.5 text-left text-xs text-k-ink';

// The stepper and the typed value share one clamp, so the two paths cannot disagree
// about what a valid threshold is.
const THRESHOLD_MIN = 1;
const THRESHOLD_MAX = 120;
const clampThreshold = (n) => Math.min(THRESHOLD_MAX, Math.max(THRESHOLD_MIN, n));

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

  const [threshold, setThreshold] = useState(String(shiftConfig.breakThresholdMinutes ?? DEFAULT_SHIFT_CONFIG.breakThresholdMinutes));
  const [viewName, setViewName] = useState('');

  useEffect(() => {
    setThreshold(String(shiftConfig.breakThresholdMinutes ?? DEFAULT_SHIFT_CONFIG.breakThresholdMinutes));
  }, [shiftConfig.breakThresholdMinutes]);

  const parsedThreshold = parseInt(threshold, 10);
  const thresholdValue = Number.isFinite(parsedThreshold) ? parsedThreshold : shiftConfig.breakThresholdMinutes;
  const thresholdDirty = Number.isFinite(parsedThreshold) && parsedThreshold !== shiftConfig.breakThresholdMinutes;

  const applyThreshold = () => {
    if (!thresholdDirty) return;
    updateShiftConfig({ ...shiftConfig, breakThresholdMinutes: clampThreshold(parsedThreshold) });
  };

  // The stepper commits instead of only editing the draft: clicking a button blurs
  // the field on some browsers and not others, and a draft-only bump would sit there
  // looking unapplied.
  const nudgeThreshold = (delta) => {
    const next = clampThreshold(thresholdValue + delta);
    if (next === thresholdValue) return;
    setThreshold(String(next));
    updateShiftConfig({ ...shiftConfig, breakThresholdMinutes: next });
  };

  const toggleColumn = (id) => setVisibleColumns({ ...visibleColumns, [id]: !visibleColumns[id] });
  const shownColumns = FILTERABLE_COLUMN_IDS.filter((id) => visibleColumns[id]).length;

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
        className="w-44 flex-none"
        primary
      />

      <ExtensionFilter
        extensions={availableExtensions}
        names={extNameMap}
        selected={selectedExtensions}
        onChange={setSelectedExtensions}
      />

      <FilterPopover label="Columns" icon={Columns} tone="region" badge={`${shownColumns}/${FILTERABLE_COLUMN_IDS.length}`}>
        <div className="space-y-0.5 p-2">
          {FILTERABLE_COLUMN_IDS.map((id) => (
            <Checkbox key={id} checked={!!visibleColumns[id]} onChange={() => toggleColumn(id)}>
              {COLUMN_BY_ID[id]?.label || id}
            </Checkbox>
          ))}
          <p className="px-2 pt-1.5 text-2xs text-k-ink-muted">
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

      {/* The stepper lives inside the field, stacked on the right the way a native
          number input does it. Flanking buttons cost the pill 40px, and this row has
          no room to spare: at 1440px a wrap drops Print/Export below the panel. */}
      {/* One hue, one hover surface. This control is about breaks, so it owns the same
          token the Timer glyph and the Break metric use: `--tone` is what the stylesheet
          hands to the edge, the glow and the stepper hovers, and leaving it unset made
          them fall through to the app accent — a blue light on a violet control. The
          number sits in a well inside the pill, separated by fill rather than by a
          second outline. */}
      {/* The height is pinned, not derived. Left to its own box this pill is 35px while
          every other control in the row is 30, because its content height is the number
          input's 21px line-and-well, not the 15px of text beside it — so any change to
          the type scale moved this one control and nothing else. */}
      <div
        style={{ '--tone': 'var(--k-break-time)' }}
        className={`field flex h-[30px] flex-none items-center gap-1 rounded-lg px-2 text-meta focus-within:border-k-break-time/70 ${
          thresholdDirty ? 'border-k-break-time/70 text-k-ink' : 'text-k-ink-muted'
        }`}
      >
        <Timer size={14} className="text-k-break-time" />
        <span>Break &gt;</span>
        <span className="relative inline-flex">
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
            className="num h-[18px] w-[2.6rem] rounded-md border border-k-break-time/25 bg-k-surface/70 px-0 text-center text-k-ink focus:outline-none"
          />
          <Stepper
            upLabel="Increase the break threshold by one minute"
            downLabel="Decrease the break threshold by one minute"
            upDisabled={thresholdValue >= THRESHOLD_MAX}
            downDisabled={thresholdValue <= THRESHOLD_MIN}
            onUp={() => nudgeThreshold(1)}
            onDown={() => nudgeThreshold(-1)}
          />
        </span>
        <span>min</span>
      </div>

      {/* Right-aligned: the sidebar costs 240px, so this is the last control
          before the rail wraps and a left-opening panel would run past the edge. */}
      <FilterPopover label="Views" icon={FloppyDisk} tone="throughput" badge={savedViews.length || ''} align="right">
        <div className="space-y-1.5 p-2">
          {savedViews.length === 0 ? (
            <p className="px-2 py-1 text-meta text-k-ink-muted">
              No saved views yet. Save the filters, columns and date range you use most.
            </p>
          ) : (
            savedViews.map((view) => (
              <div key={view.id} className="row-hover flex items-center gap-1 rounded-md px-1 py-0.5">
                <button type="button" className="hoverable flex-1 truncate rounded-md border border-transparent px-1 py-0.5 text-left text-xs text-k-ink" onClick={() => onApplyFilters(view.filters)}>
                  {view.name}
                </button>
                <span className="num text-2xs text-k-ink-muted">{view.createdAt}</span>
                <button
                  type="button"
                  aria-label={`Overwrite ${view.name} with the current filters`}
                  className="hoverable rounded-md p-1 text-k-ink-muted"
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
                  className="rounded-md p-1 text-k-ink-muted hover:bg-k-critical/15 hover:text-k-critical"
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
              className="field min-w-0 flex-1 rounded-lg px-2 py-1 text-xs text-k-ink placeholder:text-k-ink-muted focus:border-k-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={saveCurrentView}
              className="tone-btn rounded-lg px-2.5 py-1 text-meta font-semibold active:translate-y-[1px]"
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
          style={{ '--tone': 'var(--k-danger)' }}
          className="hoverable inline-flex items-center gap-1.5 rounded-lg border border-k-hairline-strong bg-k-surface-hover/60 px-3 py-1.5 text-xs font-medium text-k-ink-muted active:translate-y-[1px]"
        >
          <Printer size={15} className="text-k-danger" />
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
