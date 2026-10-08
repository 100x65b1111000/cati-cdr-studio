import React, { useMemo } from 'react';
import { FileCsv, Play } from '@phosphor-icons/react';
import { useCdr } from '../../context/CdrContext';
import Modal from '../ui/Modal';

const cell = (row, keys, fallback) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== '') return value.toString().trim().replace(/"/g, '');
  }
  return fallback;
};

export default function CdrPreviewModal() {
  const { pendingUpload, confirmPendingUpload, cancelPendingUpload, shiftConfig } = useCdr();

  const preview = useMemo(() => {
    if (!pendingUpload || !pendingUpload.rows) return null;
    const rows = pendingUpload.rows;
    const exts = new Set();

    rows.forEach((r) => {
      const ext = cell(r, ['EXTENSION', 'Extension', 'ext'], '');
      if (ext) exts.add(ext);
    });

    return { totalRows: rows.length, extCount: exts.size, sample: rows.slice(0, 8) };
  }, [pendingUpload]);

  if (!pendingUpload || !preview) return null;

  const footer = (
    <>
      <button
        type="button"
        onClick={cancelPendingUpload}
        className="rounded-lg border border-k-hairline-strong bg-k-surface-hover/60 px-3.5 py-2 text-xs font-medium text-k-ink transition-colors hover:bg-k-surface-hover active:translate-y-[1px]"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={confirmPendingUpload}
        className="glow-accent inline-flex items-center gap-1.5 rounded-lg bg-k-accent px-3.5 py-2 text-xs font-semibold text-k-accent-ink transition-opacity hover:opacity-90 active:translate-y-[1px]"
      >
        <Play size={14} weight="fill" />
        Generate rundown
      </button>
    </>
  );

  return (
    <Modal
      title="CDR upload preview"
      subtitle={pendingUpload.fileName}
      onClose={cancelPendingUpload}
      footer={footer}
    >
      <div className="space-y-4 text-xs">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-k-hairline bg-k-sunken/60 p-3">
            <span className="block text-[10px] font-semibold uppercase text-k-ink-muted">Call records</span>
            <span className="num mt-1 block text-lg font-bold text-k-accent">{preview.totalRows}</span>
          </div>
          <div className="rounded-xl border border-k-hairline bg-k-sunken/60 p-3">
            <span className="block text-[10px] font-semibold uppercase text-k-ink-muted">Extensions</span>
            <span className="num mt-1 block text-lg font-bold text-k-throughput">{preview.extCount}</span>
          </div>
          <div className="rounded-xl border border-k-hairline bg-k-sunken/60 p-3">
            <span className="block text-[10px] font-semibold uppercase text-k-ink-muted">Break threshold</span>
            <span className="num mt-1 block text-lg font-bold text-k-success">
              {shiftConfig.breakThresholdMinutes} min
            </span>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-xs font-semibold text-k-ink">First 8 rows</h3>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-k-ink-muted">
              <FileCsv size={14} />
              Check the column mapping before generating
            </span>
          </div>
          <div className="max-h-60 overflow-y-auto rounded-xl border border-k-hairline">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 border-b border-k-hairline glass-head text-[10px] uppercase tracking-wider text-k-ink-muted">
                <tr>
                  <th className="w-10 px-3 py-2 font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">Ext</th>
                  <th className="px-3 py-2 font-semibold">Call start</th>
                  <th className="px-3 py-2 font-semibold">Destination</th>
                  <th className="px-3 py-2 font-semibold">Response</th>
                  <th className="px-3.5 py-2 text-right font-semibold">Duration</th>
                  <th className="px-3 py-2 font-semibold">Region</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-k-hairline/60">
                {preview.sample.map((row, i) => {
                  const ext = cell(row, ['EXTENSION', 'Extension', 'ext'], '-');
                  const date = cell(row, ['CALL DATE (UTC)', 'CALL DATE (Asia/Kolkata)', 'CALL DATE', 'Call Date'], '-');
                  const dest = cell(row, ['DESTINATION', 'CLID'], '-');
                  const dur = cell(row, ['DURATION', 'Duration'], '0');
                  const resp = cell(row, ['RESPONSE', 'Response'], 'ANSWERED');
                  const reg = cell(row, ['REGION', 'Region'], 'Unknown');
                  const answered = resp.toUpperCase() === 'ANSWERED';

                  return (
                    <tr key={i} className="transition-colors hover:bg-k-surface-hover/40">
                      <td className="num px-3 py-1.5 text-k-ink-muted">{i + 1}</td>
                      <td className="num px-3 py-1.5 font-semibold text-k-accent">{ext}</td>
                      <td className="num px-3 py-1.5 text-k-ink">{date}</td>
                      <td className="num px-3 py-1.5 text-k-ink-muted">{dest}</td>
                      <td
                        className={`num px-3 py-1.5 ${answered ? 'text-k-success' : 'text-k-danger'}`}
                      >
                        {resp}
                      </td>
                      <td className="num px-3 py-1.5 text-right text-k-throughput">{dur}s</td>
                      <td className="px-3 py-1.5 text-k-ink-muted">{reg}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
}
