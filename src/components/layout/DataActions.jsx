import React from 'react';
import { BracketsCurly, FileCsv, FileXls, UploadSimple } from '@phosphor-icons/react';
import { useCdr } from '../../context/CdrContext';
import { rangeDates } from '../../utils/dateRange';
import { defaultVisibleColumns } from '../rundown/columns';
import { exportAnalysisToJSON, exportRundownToCSV, exportRundownToExcel } from '../../services/exportService';
import FilterPopover, { menuItem } from '../ui/FilterPopover';

// The upload label owns the file input and the parsing state. Both controls fill their
// grid cell, so the caller only decides the shape: one column in the sidebar, two in the
// bar below `lg`, where there is no sidebar to hold them.
export default function DataActions({ className = 'grid-cols-1' }) {
  const { isParsing, handleFileDropOrSelect, analysis, extNameMap, dateRange, addToast } = useCdr();

  function onFileInputChange(e) {
    const file = e.target.files?.[0];
    if (file) handleFileDropOrSelect(file);
    e.target.value = '';
  }

  // The sidebar is chrome, so it exports what chrome knows: the dataset, narrowed by the
  // header's date range. A view's own filters — search, agent picks, hidden columns —
  // belong to the view, and Print is what carries them onto paper.
  const inRange = () => {
    const dates = new Set(rangeDates(dateRange, analysis));
    return Object.fromEntries(
      Object.entries(analysis)
        .map(([ext, byDate]) => [
          ext,
          Object.fromEntries(Object.entries(byDate).filter(([date]) => dates.has(date)))
        ])
        .filter(([, byDate]) => Object.keys(byDate).length > 0)
    );
  };

  async function run(label, work) {
    const scoped = inRange();
    if (Object.keys(scoped).length === 0) {
      addToast('Nothing to export in this date range.', 'error');
      return;
    }
    try {
      await work(scoped);
    } catch (err) {
      addToast(`${label} export failed: ${err.message}`, 'error');
    }
  }

  return (
    <div className={`grid gap-2 ${className}`}>
      <label
        className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-k-accent px-3.5 py-2 text-xs font-medium text-k-accent-ink transition-colors hover:bg-k-accent/90 active:translate-y-[1px]"
      >
        <UploadSimple size={16} />
        <span aria-busy={isParsing || undefined}>{isParsing ? 'Parsing CSV' : 'Upload CDR CSV'}</span>
        <input
          type="file"
          accept=".csv"
          onChange={onFileInputChange}
          className="hidden"
        />
      </label>
      <FilterPopover label="Export" icon={FileXls} tone="success" width="w-full">
        <div className="p-1">
          <button
            type="button"
            className={menuItem}
            onClick={() =>
              run('Excel', (scoped) =>
                exportRundownToExcel(Object.values(scoped).flatMap(Object.values), defaultVisibleColumns(), 'total')
              )
            }
          >
            <FileXls size={15} className="text-k-success" />
            Excel, every agent-day
          </button>
          <button type="button" className={menuItem} onClick={() => run('CSV', (scoped) => exportRundownToCSV(scoped, extNameMap))}>
            <FileCsv size={15} className="text-k-talk" />
            CSV, every agent-day
          </button>
          <button type="button" className={menuItem} onClick={() => run('JSON', (scoped) => exportAnalysisToJSON(scoped))}>
            <BracketsCurly size={15} className="text-k-throughput" />
            JSON, full calculation
          </button>
        </div>
      </FilterPopover>
    </div>
  );
}
