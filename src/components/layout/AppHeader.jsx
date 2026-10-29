import React from 'react';
import { Moon, Sun } from '@phosphor-icons/react';
import { useCdr } from '../../context/CdrContext';
import { NAV } from './navConfig';
import DataActions from './DataActions';
import Segmented from '../ui/Segmented';
import { COLOR_MODES } from '../../theme/colorSchemes';
import { availableDates, rangeLabel } from '../../utils/dateRange';

// The dial and the two hues it can wear, so the switch reads as the thing it changes.
// The word still has to be spoken to a screen reader, so it rides along hidden rather
// than becoming a `title=`, which a keyboard or a tap never sees.
const MODE_ICONS = { dark: Moon, light: Sun };
const MODES = Object.entries(COLOR_MODES).map(([id, mode]) => {
  const Icon = MODE_ICONS[id];
  return {
    id,
    label: (
      <>
        <Icon size={14} />
        <span className="sr-only">{mode.label}</span>
      </>
    )
  };
});

// Detached floating bar: 8px clear of the viewport on three sides, and lifted off
// the page by its own shadow. It reads as a different layer from the cards because
// .app-bar fills with `sunken`, not the `surface` the content uses, so it stays
// distinguishable without needing distance. Identity on the left; what is loaded, and
// which palette paints it, on the right. Loading a file lives in the rail, and the view
// switcher does too — both only come back to the bar below lg, where there is no rail to
// hold them. The mode switch stays in the bar at every width: it is chrome, not a
// setting you should have to visit a page for.
export default function AppHeader() {
  const { activeTab, setActiveTab, rawCalls, analysis, dateRange, colorScheme, setColorScheme } = useCdr();
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
          <p className="truncate text-xs leading-tight text-k-ink-muted">CDR Team Rundown &amp; Shift Intelligence</p>
        </div>
      </div>

      {/* One cluster on the right, not two loose children: `justify-between` would
          otherwise push the status into the middle of an empty bar, and the height rule
          that keeps a switch the same height as its row measures siblings within the
          parent, where the 42px brand block would set the bar. */}
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
        <p className="flex shrink-0 items-center gap-2 text-xs leading-tight text-k-ink-muted">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-k-success" />
          <span className="num">{rawCalls.length} calls</span>
          <span className="text-k-ink-faint">·</span>
          <span className="num">{rangeLabel(dateRange, dates)}</span>
        </p>
        <Segmented label="Colour mode" options={MODES} value={colorScheme} onChange={setColorScheme} />
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

      {/* `order-last` because the nav below already claims order-3: without it these
          two would jump above the view switcher when both rows are on screen. */}
      <DataActions className="order-last w-full grid-cols-2 lg:hidden" />
    </header>
  );
}
