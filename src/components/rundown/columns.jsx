import React from 'react';
import { Eye } from '@phosphor-icons/react';
import EditCell from './EditCell';

export const DEFAULT_HIDDEN = ['date', 'region', 'shift_span', 'total_break_time', 'details'];

function connectedCell(row, { connView }) {
  const rate = row.total_calls > 0 ? Math.round((row.connected_calls / row.total_calls) * 100) : 0;

  if (connView === 'split') {
    return (
      <span className="inline-flex items-baseline justify-end gap-1.5">
        <span className="num rounded bg-k-success/10 px-2 py-0.5 text-[11px] font-semibold text-k-success">
          {row.connected_calls}
        </span>
        <span className="num rounded bg-k-danger/10 px-2 py-0.5 text-[11px] font-semibold text-k-danger">
          {row.not_connected_calls}
        </span>
        <span className="num text-[10px] text-k-ink-muted">{rate}%</span>
      </span>
    );
  }
  return <span className="num font-semibold text-k-ink">{row.total_calls}</span>;
}

export const COLUMNS = [
  {
    id: 'extension',
    label: 'Extension',
    align: 'left',
    value: (row) => row.extension,
    cell: (row, { openDetail }) => (
      <button
        type="button"
        onClick={() => openDetail(row)}
        className="num rounded-md font-semibold text-k-accent transition-colors hover:text-k-ink hover:underline"
      >
        {row.extension}
      </button>
    )
  },
  {
    id: 'name',
    label: 'Agent',
    align: 'left',
    value: (row) => row.name.toLowerCase(),
    cell: (row) => <span className="font-semibold text-k-ink">{row.name}</span>
  },
  {
    id: 'date',
    label: 'Shift date',
    align: 'left',
    value: (row) => row.date,
    cell: (row) => <span className="num text-k-ink-muted">{row.date}</span>
  },
  {
    id: 'region',
    label: 'Regions',
    align: 'left',
    cell: (row) => {
      const entries = Object.entries(row.region_counts || {}).sort((a, b) => b[1] - a[1]);
      if (entries.length === 0) return <span className="text-k-ink-faint">-</span>;
      return (
        <span className="inline-flex flex-wrap gap-1" title={row.region_summary}>
          {entries.map(([region, count]) => (
            <span
              key={region}
              className="num rounded-full border border-k-region/20 bg-k-region/10 px-2.5 py-0.5 text-[10px] text-k-region"
            >
              {region} <span className="font-semibold text-k-ink">{count}</span>
            </span>
          ))}
        </span>
      );
    }
  },
  {
    id: 'connected',
    label: 'Calls',
    align: 'right',
    value: (row) => row.total_calls,
    cell: connectedCell
  },
  {
    id: 'calls_per_hour',
    label: 'Calls/hr',
    align: 'right',
    value: (row) => parseFloat(row.calls_per_hour) || 0,
    cell: (row) => <span className="num text-k-throughput">{row.calls_per_hour}</span>
  },
  {
    id: 'half_dones',
    label: 'Half',
    align: 'right',
    value: (row) => row.half_dones,
    cell: (row, { setOverride }) => (
      <EditCell
        value={row.half_dones}
        label={`Half dones for ${row.extension} on ${row.date}`}
        onCommit={(v) => setOverride(row.extension, row.date, 'halfDones', v)}
      />
    )
  },
  {
    id: 'surveys',
    label: 'Surveys',
    align: 'right',
    value: (row) => row.surveys,
    cell: (row, { setOverride }) => (
      <EditCell
        value={row.surveys}
        label={`Surveys for ${row.extension} on ${row.date}`}
        onCommit={(v) => setOverride(row.extension, row.date, 'surveys', v)}
      />
    )
  },
  {
    id: 'talk_time',
    label: 'Talk',
    align: 'right',
    value: (row) => row.total_talk_time_sec,
    cell: (row) => <span className="num text-k-talk">{row.total_talk_time_formatted}</span>
  },
  {
    id: 'shift_span',
    label: 'Span',
    align: 'left',
    cell: (row) => (
      <span className="num text-[11px] text-k-ink-muted">
        {row.first_call} {row.last_call}
      </span>
    )
  },
  {
    id: 'break_stamps',
    label: 'Break stamps',
    align: 'left',
    cell: (row) => {
      const breaks = row.breaks_list || [];
      if (breaks.length === 0) return <span className="text-k-ink-faint">-</span>;
      return (
        <span className="inline-flex flex-wrap gap-1">
          {breaks.map((b, i) => (
            <span
              key={i}
              title={`${b.start} to ${b.end} · ${b.duration_formatted} idle`}
              className="num rounded bg-k-break-time/10 px-1.5 py-0.5 text-[10px] text-k-break-time"
            >
              {b.start} - {b.end}
            </span>
          ))}
        </span>
      );
    }
  },
  {
    id: 'breaks_count',
    label: 'Total breaks',
    align: 'right',
    value: (row) => row.breaks_count,
    cell: (row) => {
      if (!row.breaks_count)
        return <span className="num rounded bg-k-hairline/60 px-2 py-0.5 text-[11px] text-k-ink-muted">0</span>;
      const summary = row.breaks_list.map((b) => `${b.start} ${b.end} ${b.duration_formatted}`).join('\n');
      return (
        <span
          title={summary}
          className="num rounded bg-k-throughput/10 px-2 py-0.5 text-[11px] font-semibold text-k-throughput"
        >
          {row.breaks_count}
        </span>
      );
    }
  },
  {
    id: 'total_break_time',
    label: 'Break time',
    align: 'right',
    value: (row) => row.total_break_sec,
    cell: (row) =>
      row.breaks_count > 0 ? (
        <span className="num text-k-break-time">{row.total_break_formatted}</span>
      ) : (
        <span className="text-k-ink-faint">-</span>
      )
  },
  {
    id: 'net_active',
    label: 'Net active',
    align: 'right',
    value: (row) => row.net_active_sec,
    cell: (row) => <span className="num font-semibold text-k-region">{row.net_active_formatted}</span>
  },
  {
    id: 'details',
    label: 'Details',
    align: 'center',
    cell: (row, { openDetail }) => (
      <button
        type="button"
        aria-label={`Breakdown for ${row.extension} on ${row.date}`}
        onClick={() => openDetail(row)}
        className="flex items-center gap-1 rounded-md bg-k-accent/20 px-2.5 py-1 text-[11px] font-medium text-k-accent transition-colors hover:bg-k-accent hover:text-k-accent-ink"
      >
        <Eye size={14} />
      </button>
    )
  }
];

export const COLUMN_BY_ID = Object.fromEntries(COLUMNS.map((c) => [c.id, c]));

export function defaultVisibleColumns() {
  return Object.fromEntries(COLUMNS.map((c) => [c.id, !DEFAULT_HIDDEN.includes(c.id)]));
}
