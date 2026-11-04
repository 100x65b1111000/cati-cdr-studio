import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import EmptyState from './EmptyState';

// Registered once, in the module every chart user imports. This used to be a side effect
// of AnalyticsView, so a chart anywhere else only worked if the analytics view had
// already been loaded at least once in the session.
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function ChartSkeleton() {
  return (
    <div className="flex h-full items-end gap-3" role="status" aria-label="Recalculating charts">
      {[45, 70, 30, 60, 85, 40, 65, 50, 75, 35].map((h, i) => (
        <div
          key={i}
          className="animate-pulse rounded bg-k-hairline"
          style={{ height: `${h}%`, width: '10%' }}
        />
      ))}
    </div>
  );
}

// The chart plate: the same sunken header the rundown KPI strip wears, welded to the body
// by a single hairline. The title is the only thing on the left and the note — a counted
// fact — sits at the right in mono. `body` carries the height because the plots are not
// meant to be the same size: the lead chart on a screen gets the tall one.
export default function Chart({ title, note, empty, loading, body = 'h-72', className = '', children }) {
  return (
    <section className={`panel overflow-hidden rounded ${className}`}>
      <header className="flex items-baseline justify-between gap-3 border-b border-k-hairline bg-k-sunken px-3.5 py-2.5">
        <h3 className="text-xs font-semibold text-k-ink">{title}</h3>
        <span className="num text-2xs text-k-ink-muted">{note}</span>
      </header>
      <div className={`${body} p-4`}>
        {loading ? (
          <ChartSkeleton />
        ) : empty ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState title={empty} />
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
