import React from 'react';
import { GlyphUpload as UploadSimple, GlyphCode as BracketsCurly, GlyphFileCsv as FileCsv, GlyphFileXls as FileXls, GlyphPrinter as Printer } from '../ui/Glyph';
import { useCdr } from '../../context/CdrContext';
import { rangeDates } from '../../utils/dateRange';
import { defaultVisibleColumns } from '../rundown/columns';
import { exportAnalysisToJSON, exportRundownToCSV, exportRundownToExcel } from '../../services/exportService';
import FilterPopover, { menuItem } from '../ui/FilterPopover';

// The upload label owns the file input and the parsing state. Both controls fill their
// grid cell, so the caller only decides the shape: a row across the header's right edge.
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

  // One list, one rendering: the popover's rows, in the bar and in the dock alike.
  // `label` is the whole row — the icon carries the format, a sentence under it is the
  // same fact twice and wraps a narrow panel to three lines. It doubles as the toast
  // name in run(), the hue class paints the icon.
  const EXPORTS = [
    ['Excel', FileXls, 'text-k-success', (scoped) =>
      exportRundownToExcel(Object.values(scoped).flatMap(Object.values), defaultVisibleColumns(), 'total')],
    ['CSV', FileCsv, 'text-k-talk', (scoped) => exportRundownToCSV(scoped, extNameMap)],
    ['JSON', BracketsCurly, 'text-k-throughput', (scoped) => exportAnalysisToJSON(scoped)]
  ];

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
      {/* Export and Print are desk work: on a phone the bar keeps the one action it is
          for and the rest of its width for the view. `contents` puts the two back into
          the caller's grid at sm and above, so they are still siblings of the upload,
          not a nested row. */}
      <div className="hidden sm:contents">
        <FilterPopover label="Export" icon={FileXls} tone="success" width="w-full">
          <div className="p-1">
            {EXPORTS.map(([label, Icon, hue, work]) => (
              <button key={label} type="button" className={menuItem} onClick={() => run(label, work)}>
                <Icon style={{ fontSize: 15 }} className={hue} />
                {label}
              </button>
            ))}
          </div>
        </FilterPopover>

        {/* Print is the third way data leaves the app, and unlike the two above it goes
            to the paper the browser is showing, so the cluster keeps them together. */}
        <button
          type="button"
          onClick={() => window.print()}
          style={{ '--tone': 'var(--k-danger)' }}
          className="hoverable inline-flex h-7 w-full items-center justify-center gap-1.5 rounded border border-k-hairline bg-k-surface-hover/50 px-2.5 text-xs font-medium text-k-ink-muted active:translate-y-[1px]"
        >
          <Printer style={{ fontSize: 15 }} className="text-k-danger" />
          <span>Print</span>
        </button>
      </div>
    </div>
  );
}
