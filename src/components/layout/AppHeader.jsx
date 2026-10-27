import React from 'react';
import { useCdr } from '../../context/CdrContext';
import { NAV } from './navConfig';
import DataActions from './DataActions';
import { availableDates, rangeLabel } from '../../utils/dateRange';

// Detached floating bar: 8px clear of the viewport on three sides, and lifted off
// the page by its own shadow. It reads as a different layer from the cards because
// .app-bar fills with `sunken`, not the `surface` the content uses, so it stays
// distinguishable without needing distance. Brand on the left, upload/sample on the
// right, at every width. The view switcher only lives here below lg; above it the
// rail owns it.
export default function AppHeader() {
  const { activeTab, setActiveTab, rawCalls, analysis, dateRange } = useCdr();
  const dates = availableDates(analysis);

  return (
    <header className="app-bar no-print sticky top-2 z-40 mx-2 mt-2 flex flex-wrap items-center justify-between gap-4 rounded-2xl px-6 py-4">
      <div className="flex min-w-0 items-center gap-3">
        {/* The shift dial, same geometry as public/favicon.svg, drawn through the
            theme roles so it re-colours with the scheme instead of being a picture. */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-k-surface ring-1 ring-inset ring-k-hairline">
          <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
            <path d="M16 6.4A9.6 9.6 0 1 1 6.4 16" fill="none" strokeWidth="3.5" strokeLinecap="round" style={{ stroke: 'rgb(var(--k-accent))' }} />
            <path d="M6.4 16A9.6 9.6 0 0 1 16 6.4" fill="none" strokeWidth="3.5" strokeLinecap="round" style={{ stroke: 'rgb(var(--k-throughput))' }} />
            <circle cx="16" cy="16" r="2.6" style={{ fill: 'rgb(var(--k-talk))' }} />
          </svg>
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold leading-tight tracking-tight text-k-ink">
            CATI CDR Studio
          </h1>
          <p className="flex items-center gap-2 truncate text-xs leading-tight text-k-ink-muted">
            <span>CDR Team Rundown &amp; Shift Intelligence</span>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-k-success" />
            <span className="num text-k-ink-muted">
              {rawCalls.length} calls, {rangeLabel(dateRange, dates)}
            </span>
          </p>
        </div>
      </div>

      <nav
        aria-label="Views"
        className="order-3 flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-k-hairline bg-k-surface/70 p-1.5 md:order-none md:w-auto lg:hidden"
      >
        {NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            aria-current={activeTab === id ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${
              activeTab === id
                ? 'bg-k-accent text-k-accent-ink'
                : 'hoverable text-k-ink-muted'
            }`}
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <DataActions />
    </header>
  );
}
