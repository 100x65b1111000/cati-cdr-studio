import React from 'react';
import { useCdr } from '../../context/CdrContext';
import Modal from '../ui/Modal';

function Metric({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-k-hairline bg-k-sunken/60 p-3">
      <span className="block text-2xs font-semibold uppercase text-k-ink-muted">{label}</span>
      <span className={`num mt-1 block text-sm font-bold ${tone}`}>{value}</span>
    </div>
  );
}

export default function AgentDetailModal() {
  const { selectedAgentDetail, setSelectedAgentDetail, analysis, shiftConfig } = useCdr();

  if (!selectedAgentDetail) return null;

  const { ext, dateStr } = selectedAgentDetail;
  const data = analysis[ext]?.[dateStr];

  if (!data) return null;

  const regions = Object.entries(data.region_counts || {});
  const close = () => setSelectedAgentDetail(null);

  return (
    <Modal
      title={`Extension ${ext} · ${data.name}`}
      subtitle={`Shift date ${dateStr}`}
      onClose={close}
      width="max-w-2xl"
    >
      <div className="space-y-5 text-xs">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric label="Total talk time" value={data.total_talk_time_formatted} tone="text-k-talk" />
          <Metric
            label={`Long breaks over ${shiftConfig.breakThresholdMinutes} min`}
            value={data.breaks_count}
            tone="text-k-break-time"
          />
          <Metric label="Net active time" value={data.net_active_formatted} tone="text-k-ink" />
        </div>

        <div>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-k-ink-muted">Calls by region</h3>
          {regions.length === 0 ? (
            <p className="text-k-ink-muted">No region recorded for this shift.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {regions.map(([reg, count]) => (
                <span
                  key={reg}
                  className="num rounded-full border border-k-region/20 bg-k-region/10 px-2.5 py-0.5 text-meta text-k-region"
                >
                  {reg} <span className="font-semibold text-k-ink">{count}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-k-ink-muted">Idle breaks log</h3>
          <div className="max-h-60 overflow-y-auto rounded-xl border border-k-hairline">
            <table className="w-full text-left text-xs text-k-ink-muted">
              <thead className="sticky top-0 border-b border-k-hairline thead text-2xs uppercase tracking-wider">
                <tr>
                  <th className="w-10 px-3.5 py-2 font-semibold">#</th>
                  <th className="px-3.5 py-2 font-semibold">Start</th>
                  <th className="px-3.5 py-2 font-semibold">End</th>
                  <th className="px-3.5 py-2 text-right font-semibold">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-k-hairline/60">
                {(data.breaks_list || []).length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-3.5 py-4 text-center text-k-ink-muted">
                      No break longer than {shiftConfig.breakThresholdMinutes} minutes.
                    </td>
                  </tr>
                ) : (
                  data.breaks_list.map((b, idx) => (
                    <tr key={idx} className="row-hover">
                      <td className="num px-3.5 py-2 text-k-ink-muted">{idx + 1}</td>
                      <td className="num px-3.5 py-2 text-k-ink">{b.start}</td>
                      <td className="num px-3.5 py-2 text-k-ink">{b.end}</td>
                      <td className="num px-3.5 py-2 text-right text-k-throughput">{b.duration_formatted}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
}
