import React from 'react';
import { GlyphEye as Eye } from '../ui/Glyph';
import EditCell from './EditCell';
import Chip from '../ui/Chip';
import Tip from '../ui/Tip';

export const DEFAULT_HIDDEN = ['date', 'region', 'shift_span', 'total_break_time'];

function connectedCell(row, { connView }) {
  const rate = row.total_calls > 0 ? Math.round((row.connected_calls / row.total_calls) * 100) : 0;

  if (connView === 'split') {
    return (
      <span className="inline-flex items-baseline justify-center gap-1.5">
        <Chip tone="success" size="md">
          {row.connected_calls}
        </Chip>
        <Chip tone="danger" size="md">
          {row.not_connected_calls}
        </Chip>
        <span className="num text-2xs text-k-ink-muted">{rate}%</span>
      </span>
    );
  }
  return (
    <Chip tone="accent" size="md">
      {row.total_calls}
    </Chip>
  );
}

/* Every column centres. These are short, comparable values and a left-aligned
   island in the middle of the grid just reads as a ragged edge. Cells that lay
   themselves out (the Details button, the stacked stamps) centre their own box. */
export const COLUMNS = [
  {
    id: 'extension',
    label: 'Extension',
    align: 'center',
    value: (row) => row.extension,
    // Plain text, not a control: a click takes the figure to the clipboard, and the
    // Details column stays the only way into the panel.
    cell: (row) => <span className="num font-medium text-k-accent-fg">{row.extension}</span>
  },
  {
    id: 'name',
    label: 'Agent',
    align: 'center',
    value: (row) => row.name.toLowerCase(),
    cell: (row) => <span className="font-semibold text-k-ink">{row.name}</span>
  },
  {
    id: 'date',
    label: 'Shift date',
    align: 'center',
    value: (row) => row.date,
    cell: (row) => <span className="num text-k-ink-muted">{row.date}</span>
  },
  {
    id: 'region',
    label: 'Regions',
    align: 'center',
    cell: (row) => {
      const entries = Object.entries(row.region_counts || {}).sort((a, b) => b[1] - a[1]);
      if (entries.length === 0) return <span className="text-k-ink-faint">-</span>;
      return (
        <Tip label={row.region_summary} className="inline-flex flex-wrap gap-1">
          {entries.map(([region, count]) => (
            <Chip key={region} tone="region">
              {region} <span className="font-semibold">{count}</span>
            </Chip>
          ))}
        </Tip>
      );
    }
  },
  {
    id: 'connected',
    label: 'Calls',
    align: 'center',
    value: (row) => row.total_calls,
    cell: connectedCell
  },
  {
    id: 'calls_per_hour',
    label: 'Calls/hr',
    align: 'center',
    value: (row) => parseFloat(row.calls_per_hour) || 0,
    cell: (row) => <span className="num text-k-warning">{row.calls_per_hour}</span>
  },
  {
    id: 'half_dones',
    label: 'Half',
    align: 'center',
    value: (row) => row.half_dones,
    cell: (row, { setOverride }) => (
      <EditCell
        tone="text-k-throughput"
        value={row.half_dones}
        label={`Half dones for ${row.extension} on ${row.date}`}
        onCommit={(v) => setOverride(row.extension, row.date, 'halfDones', v)}
      />
    )
  },
  {
    id: 'surveys',
    label: 'Surveys',
    align: 'center',
    value: (row) => row.surveys,
    cell: (row, { setOverride }) => (
      <EditCell
        tone="text-k-success"
        value={row.surveys}
        label={`Surveys for ${row.extension} on ${row.date}`}
        onCommit={(v) => setOverride(row.extension, row.date, 'surveys', v)}
      />
    )
  },
  {
    id: 'talk_time',
    label: 'Talk',
    align: 'center',
    value: (row) => row.total_talk_time_sec,
    cell: (row) => <span className="num text-k-talk">{row.total_talk_time_formatted}</span>
  },
  {
    id: 'shift_span',
    label: 'Span',
    align: 'center',
    cell: (row) => (
      <span className="num text-meta text-k-ink-muted">
        {row.first_call} {row.last_call}
      </span>
    )
  },
  {
    id: 'break_stamps',
    label: 'Breaks',
    align: 'center',
    cell: (row) => {
      const breaks = row.breaks_list || [];
      if (breaks.length === 0) return <span className="text-k-ink-faint">-</span>;
      return (
        <span className="flex flex-col items-center gap-0.5 py-1.5">
          {breaks.map((b, i) => (
            <Tip key={i} className="flex justify-center" label={`${b.start} to ${b.end} · ${b.duration_formatted} idle`}>
              <Chip tone="break-time">
                {b.start} - {b.end} ({Math.round(b.duration_seconds / 60)}m)
              </Chip>
            </Tip>
          ))}
        </span>
      );
    }
  },
  {
    id: 'breaks_count',
    label: 'Total breaks',
    align: 'center',
    value: (row) => row.breaks_count,
    cell: (row) => {
      if (!row.breaks_count)
        return <Chip tone="neutral">0</Chip>;
      const summary = row.breaks_list.map((b) => `${b.start} ${b.end} ${b.duration_formatted}`).join('\n');
      return (
        <Tip className="flex justify-center" label={summary}>
          <Chip tone="throughput" size="md">
            {row.breaks_count}
          </Chip>
        </Tip>
      );
    }
  },
  {
    id: 'total_break_time',
    label: 'Break time',
    align: 'center',
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
    align: 'center',
    value: (row) => row.net_active_sec,
    cell: (row) => <span className="num font-medium text-k-region">{row.net_active_formatted}</span>
  },
  {
    id: 'details',
    label: 'Details',
    align: 'center',
    // The only way to reach the per-agent breakdown from the table, so it is not
    // something the Columns menu can switch off.
    locked: true,
    cell: (row, { openDetail }) => (
      <button
        type="button"
        aria-label={`Breakdown for ${row.extension} on ${row.date}`}
        onClick={() => openDetail(row)}
        className="inline-flex items-center gap-1 rounded bg-k-accent-fg/20 px-2.5 py-1 text-meta font-medium text-k-accent-fg transition-colors hover:bg-k-accent hover:text-k-accent-ink"
      >
        <Eye style={{ fontSize: 14 }} />
      </button>
    )
  }
];

export const COLUMN_BY_ID = Object.fromEntries(COLUMNS.map((c) => [c.id, c]));

export const FILTERABLE_COLUMN_IDS = COLUMNS.filter((c) => !c.locked).map((c) => c.id);

export function defaultVisibleColumns() {
  return Object.fromEntries(COLUMNS.map((c) => [c.id, c.locked || !DEFAULT_HIDDEN.includes(c.id)]));
}
