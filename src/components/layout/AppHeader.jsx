import React from 'react';
import { Phone } from '@phosphor-icons/react';
import { useCdr } from '../../context/CdrContext';
import { NAV } from './navConfig';
import DataActions from './DataActions';
import { availableDates, rangeLabel } from '../../utils/dateRange';

// Full-width strip: brand on the left, upload/sample on the right, at every
// width. The view switcher only lives here below lg; above it the rail owns it.
export default function AppHeader() {
  const { activeTab, setActiveTab, rawCalls, analysis, dateRange } = useCdr();
  const dates = availableDates(analysis);

  return (
    <header className="panel no-print sticky top-0 z-40 flex flex-wrap items-center justify-between gap-4 px-6 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="glow-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-k-accent to-k-region text-k-accent-ink">
          <Phone size={20} weight="fill" />
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
        className="order-3 flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-k-hairline bg-k-sunken/80 p-1.5 md:order-none md:w-auto lg:hidden"
      >
        {NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            aria-current={activeTab === id ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${
              activeTab === id
                ? 'glow-accent bg-k-accent text-k-accent-ink'
                : 'text-k-ink-muted hover:bg-k-surface-hover hover:text-k-ink'
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
