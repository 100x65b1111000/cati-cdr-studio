import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { useCdr } from '../../context/CdrContext';
import { themeColor } from '../../theme/colorSchemes';
import { reducedMotion } from '../../utils/motion';
import { createShiftDateResolver, summariseRedials } from '../../services/shiftCalculator';
import { formatTimeOnly } from '../../utils/timeFormatter';
import Modal from '../ui/Modal';
import Chart from '../ui/Chart';
import Chip from '../ui/Chip';

// The rundown row is one agent on one shift, and the sheet used to answer three of its
// questions. Everything the calculator already computed for that cell is here, plus the
// two things only the raw rows can give: which numbers got redialled, and how the hour
// by hour shape of the shift looked.

function Fact({ label, value, tone = 'text-k-ink' }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-2xs text-k-ink-muted">{label}</dt>
      <dd className={`num text-sm font-semibold leading-tight ${tone}`}>{value}</dd>
    </div>
  );
}

export default function AgentDetailModal() {
  const { selectedAgentDetail, setSelectedAgentDetail, analysis, shiftConfig, rawCalls, colorScheme } = useCdr();
  const ext = selectedAgentDetail?.ext;
  const dateStr = selectedAgentDetail?.dateStr;

  const resolveShiftDate = useMemo(() => createShiftDateResolver(shiftConfig), [shiftConfig]);

  const dayCalls = useMemo(
    () =>
      ext && dateStr
        ? rawCalls
            .filter((c) => c.extension === ext && resolveShiftDate(c.start_time) === dateStr)
            .sort((a, b) => a.start_time - b.start_time)
        : [],
    [rawCalls, ext, dateStr, resolveShiftDate]
  );

  // One pass over the agent's shift, bucketed by clock hour from the first call, so the
  // night reads in the order it happened instead of starting at midnight.
  const hours = useMemo(() => {
    if (!dayCalls.length) return { labels: [], calls: [], talk: [] };
    const first = dayCalls[0].start_time.getTime();
    const span = Math.min(48, Math.floor((dayCalls[dayCalls.length - 1].start_time.getTime() - first) / 3600000) + 1);
    const labels = Array.from({ length: span }, (_, i) => `${String(new Date(first + i * 3600000).getHours()).padStart(2, '0')}:00`);
    const calls = new Array(span).fill(0);
    const talk = new Array(span).fill(0);
    dayCalls.forEach((c) => {
      const i = Math.floor((c.start_time.getTime() - first) / 3600000);
      if (i >= 0 && i < span) {
        calls[i] += 1;
        talk[i] += c.duration / 60;
      }
    });
    return { labels, calls, talk: talk.map((v) => Math.round(v * 10) / 10) };
  }, [dayCalls]);

  // Built with the buckets rather than in the JSX: a fresh options object on every render
  // makes react-chartjs-2 call update() mid-ramp, and the chart snaps to its data.
  const hourChart = useMemo(() => {
    const inkMuted = themeColor(colorScheme, 'ink-muted');
    const grid = { ticks: { color: inkMuted }, grid: { color: themeColor(colorScheme, 'hairline') } };
    return {
      data: {
        labels: hours.labels,
        datasets: [
          {
            label: 'Calls',
            data: hours.calls,
            backgroundColor: themeColor(colorScheme, 'accent-fg'),
            borderRadius: 4,
            maxBarThickness: 44
          },
          {
            label: 'Talk (min)',
            type: 'line',
            data: hours.talk,
            borderColor: themeColor(colorScheme, 'talk'),
            yAxisID: 'y1',
            tension: 0.3,
            pointRadius: 2,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: reducedMotion() ? 0 : 500, easing: 'easeOutQuart' },
        plugins: { legend: { labels: { color: themeColor(colorScheme, 'ink'), boxWidth: 10, boxHeight: 10 } } },
        scales: {
          x: grid,
          y: { ...grid, beginAtZero: true, title: { display: true, text: 'Calls', color: inkMuted } },
          y1: { position: 'right', beginAtZero: true, ticks: { color: inkMuted }, grid: { display: false } }
        }
      }
    };
  }, [hours, colorScheme]);

  const redials = useMemo(() => summariseRedials(dayCalls), [dayCalls]);

  const responses = useMemo(() => {
    const map = new Map();
    dayCalls.forEach((c) => map.set(c.response, (map.get(c.response) || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [dayCalls]);

  // The same shift, everyone else: an agent's 40 calls mean nothing until you know the
  // night averaged 18.
  const peers = useMemo(() => Object.values(analysis).map((byDate) => byDate?.[dateStr]).filter(Boolean), [analysis, dateStr]);
  const mean = (pick) => (peers.length ? peers.reduce((sum, p) => sum + pick(p), 0) / peers.length : 0);

  const data = ext && dateStr ? analysis[ext]?.[dateStr] : null;
  if (!selectedAgentDetail || !data) return null;

  const close = () => setSelectedAgentDetail(null);
  const regions = Object.entries(data.region_counts || {});
  const total = data.total_calls || 1;
  const connectRate = Math.round((data.connected_calls / total) * 100);
  const longestBreak = (data.breaks_list || []).reduce((m, b) => Math.max(m, b.duration_seconds), 0);
  const compare = [
    { label: 'Calls', mine: data.total_calls, theirs: mean((p) => p.total_calls), fmt: (v) => Math.round(v) },
    { label: 'Connect rate', mine: connectRate, theirs: mean((p) => (p.connected_calls / (p.total_calls || 1)) * 100), fmt: (v) => `${Math.round(v)}%` },
    { label: 'Net active', mine: data.net_active_sec / 60, theirs: mean((p) => p.net_active_sec / 60), fmt: (v) => `${Math.round(v)} min` },
    { label: 'Calls per hour', mine: Number(data.calls_per_hour), theirs: mean((p) => Number(p.calls_per_hour)), fmt: (v) => v.toFixed(1) }
  ];

  return (
    <Modal
      title={data.name && data.name !== '-' ? data.name : `Extension ${ext}`}
      subtitle={`Extension ${ext} · shift ${dateStr}`}
      onClose={close}
      width="max-w-3xl"
    >
      <div className="space-y-4 text-xs">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded border border-k-hairline bg-k-sunken/60 p-3.5 sm:grid-cols-4">
          <Fact label="Total calls" value={data.total_calls} />
          <Fact label="Connected" value={data.connected_calls} tone="text-k-success" />
          <Fact label="Not connected" value={data.not_connected_calls} tone="text-k-danger" />
          <Fact label="Connect rate" value={`${connectRate}%`} />
          <Fact label="Placed" value={data.placed_calls} />
          <Fact label="Received" value={data.received_calls} />
          <Fact label="Talk time" value={data.total_talk_time_formatted} tone="text-k-talk" />
          <Fact label="Idle breaks over threshold" value={data.breaks_count} tone="text-k-break-time" />
          <Fact label="Break time" value={data.total_break_formatted} tone="text-k-break-time" />
          <Fact label="Net active" value={data.net_active_formatted} />
          <Fact label="Longest break" value={longestBreak ? `${Math.floor(longestBreak / 60)} min` : '—'} />
          <Fact label="Session span" value={data.session_span_formatted} />
          <Fact label="First call" value={data.first_call} />
          <Fact label="Last call" value={data.last_call} />
          <Fact label="Calls per hour" value={data.calls_per_hour} />
          <Fact label="Half dones" value={data.half_dones} tone="text-k-throughput" />
          <Fact label="Surveys" value={data.surveys} tone="text-k-throughput" />
          <Fact label="Threshold" value={`${shiftConfig.breakThresholdMinutes} min`} tone="text-k-ink-muted" />
        </dl>


        <section className="panel overflow-hidden rounded">
          <header className="flex items-baseline justify-between gap-3 border-b border-k-hairline bg-k-sunken px-3.5 py-2.5">
            <h3 className="text-xs font-semibold text-k-ink">Redialled numbers</h3>
            <span className="num text-2xs text-k-ink-muted">
              {redials.extra} repeat {redials.extra === 1 ? 'call' : 'calls'} to {redials.repeated} of {redials.numbers} numbers
            </span>
          </header>
          {redials.top.length === 0 ? (
            <p className="px-3.5 py-4 text-center text-k-ink-muted">
              Every number was reached once. {redials.numbers} distinct {redials.numbers === 1 ? 'number' : 'numbers'} this shift.
            </p>
          ) : (
            <ul className="divide-y divide-k-hairline/60">
              {redials.top.map((e) => (
                <li key={e.dest} className="row-hover flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3.5 py-2">
                  <span className="num min-w-0 flex-1 truncate text-k-ink">{e.dest}</span>
                  <span className="num text-xs font-semibold text-k-throughput">{e.calls} calls</span>
                  <span className="num text-2xs text-k-ink-muted">{e.answered} answered</span>
                  <span className="num text-2xs text-k-ink-muted">{Math.round(e.sec / 60)} min talk</span>
                  <span className="num text-2xs text-k-ink-muted">last {formatTimeOnly(e.last)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <section className="panel overflow-hidden rounded">
            <header className="flex items-baseline justify-between gap-3 border-b border-k-hairline bg-k-sunken px-3.5 py-2.5">
              <h3 className="text-xs font-semibold text-k-ink">Against this shift</h3>
              <span className="num text-2xs text-k-ink-muted">{peers.length} agents</span>
            </header>
            <ul className="divide-y divide-k-hairline/60">
              {compare.map((row) => {
                const delta = row.mine - row.theirs;
                const better = Math.abs(delta) < 0.51;
                return (
                  <li key={row.label} className="flex items-baseline justify-between gap-3 px-3.5 py-2">
                    <span className="text-k-ink-muted">{row.label}</span>
                    <span className="flex items-baseline gap-2">
                      <span className="num text-xs text-k-ink-muted">{row.fmt(row.theirs)} avg</span>
                      <span className={`num text-xs font-semibold ${better ? 'text-k-ink' : delta > 0 ? 'text-k-success' : 'text-k-danger'}`}>
                        {row.fmt(row.mine)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="panel overflow-hidden rounded">
            <header className="flex items-baseline justify-between gap-3 border-b border-k-hairline bg-k-sunken px-3.5 py-2.5">
              <h3 className="text-xs font-semibold text-k-ink">Outcome and reach</h3>
              <span className="num text-2xs text-k-ink-muted">{total} calls</span>
            </header>
            <div className="space-y-3 p-3.5">
              <div className="flex flex-wrap gap-1.5">
                {responses.map(([resp, count]) => (
                  <Chip key={resp} tone={resp === 'ANSWERED' ? 'success' : 'danger'}>
                    {resp} {count}
                  </Chip>
                ))}
              </div>
              {regions.length === 0 ? (
                <p className="text-k-ink-muted">No region recorded for this shift.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {regions.map(([reg, count]) => (
                    <Chip key={reg} tone="region">
                      {reg} {count}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="panel overflow-hidden rounded">
          <header className="flex items-baseline justify-between gap-3 border-b border-k-hairline bg-k-sunken px-3.5 py-2.5">
            <h3 className="text-xs font-semibold text-k-ink">Idle breaks log</h3>
            <span className="num text-2xs text-k-ink-muted">over {shiftConfig.breakThresholdMinutes} min</span>
          </header>
          <div className="max-h-60 overflow-y-auto">
            <table className="w-full text-left text-xs text-k-ink-muted">
              <thead className="thead sticky top-0 border-b border-k-hairline bg-k-sunken text-meta font-bold">
                <tr>
                  <th className="w-10 px-3.5 py-2">#</th>
                  <th className="px-3.5 py-2">Start</th>
                  <th className="px-3.5 py-2">End</th>
                  <th className="px-3.5 py-2 text-right">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-k-hairline/60">
                {(data.breaks_list || []).length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-3.5 py-4 text-center">
                      No break longer than {shiftConfig.breakThresholdMinutes} minutes.
                    </td>
                  </tr>
                ) : (
                  data.breaks_list.map((b, idx) => (
                    <tr key={idx} className="row-hover">
                      <td className="num px-3.5 py-2">{idx + 1}</td>
                      <td className="num px-3.5 py-2 text-k-ink">{b.start}</td>
                      <td className="num px-3.5 py-2 text-k-ink">{b.end}</td>
                      <td className="num px-3.5 py-2 text-right text-k-throughput">{b.duration_formatted}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
        <Chart title="Hour by hour" note={`${hours.labels.length} hours · ${data.first_call} to ${data.last_call}`} body="h-56">
          <Bar data={hourChart.data} options={hourChart.options} />
        </Chart>

      </div>
    </Modal>
  );
}
