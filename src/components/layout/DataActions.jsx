import React from 'react';
import { ArrowUploadRegular as UploadSimple, CodeRegular as BracketsCurly, DocumentCsvRegular as FileCsv, DocumentExcelRegular as FileXls } from '@fluentui/react-icons';
import { useCdr } from '../../context/CdrContext';
import { rangeDates } from '../../utils/dateRange';
import { defaultVisibleColumns } from '../rundown/columns';
import { exportAnalysisToJSON, exportRundownToCSV, exportRundownToExcel } from '../../services/exportService';
import FilterPopover, { menuItem } from '../ui/FilterPopover';

// The upload label owns the file input and the parsing state. Both controls fill their
// grid cell, so the caller only decides the shape: one column in the sidebar, two in the
// bar below `lg`, where there is no sidebar to hold them. `compact` is the collapsed
// rail: a popover menu cannot escape the aside's `overflow-hidden`, so the formats get
// their own icon buttons instead of an "Export" trigger.
export default function DataActions({ className = 'grid-cols-1', compact = false }) {
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

  // One list, two renderings: the popover's rows below lg and the rail's icon
  // buttons above it. `label` doubles as the toast name in run(). The hue class
  // paints the icon; the `--tone` triplet is the same hue for `.hoverable`'s wash.
  const EXPORTS = [
    ['Excel', FileXls, 'text-k-success', 'var(--k-success)', 'Excel, every agent-day', (scoped) =>
      exportRundownToExcel(Object.values(scoped).flatMap(Object.values), defaultVisibleColumns(), 'total')],
    ['CSV', FileCsv, 'text-k-talk', 'var(--k-talk)', 'CSV, every agent-day', (scoped) => exportRundownToCSV(scoped, extNameMap)],
    ['JSON', BracketsCurly, 'text-k-throughput', 'var(--k-throughput)', 'JSON, full calculation', (scoped) => exportAnalysisToJSON(scoped)]
  ];

  if (compact) {
    return (
      <div className={`grid gap-2 ${className}`}>
        <label
          aria-label={isParsing ? 'Parsing CSV' : 'Upload CDR CSV'}
          className="flex h-7 cursor-pointer items-center justify-center rounded bg-k-accent text-k-accent-ink transition-colors hover:bg-k-accent/90 active:translate-y-[1px]"
        >
          <UploadSimple style={{ fontSize: 16 }} aria-busy={isParsing || undefined} />
          <input type="file" accept=".csv" onChange={onFileInputChange} className="hidden" />
        </label>
        {EXPORTS.map(([label, Icon, hue, tone, , work]) => (
          <button
            key={label}
            type="button"
            onClick={() => run(label, work)}
            aria-label={`Export ${label}`}
            title={`Export ${label}`}
            style={{ '--tone': tone }}
            className="hoverable flex h-7 w-full items-center justify-center rounded"
          >
            <Icon style={{ fontSize: 16 }} className={hue} />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid gap-2 ${className}`}>
      <label
        className="flex h-7 cursor-pointer items-center justify-center gap-2 rounded bg-k-accent px-3.5 text-xs font-medium text-k-accent-ink transition-colors hover:bg-k-accent/90 active:translate-y-[1px]"
      >
        <UploadSimple style={{ fontSize: 16 }} />
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
          {EXPORTS.map(([label, Icon, hue, , text, work]) => (
            <button key={label} type="button" className={menuItem} onClick={() => run(label, work)}>
              <Icon style={{ fontSize: 15 }} className={hue} />
              {text}
            </button>
          ))}
        </div>
      </FilterPopover>
    </div>
  );
}
