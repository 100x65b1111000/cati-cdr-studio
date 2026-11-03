import React from 'react';
import { flushSync } from 'react-dom';
import { WeatherMoonRegular as Moon, WeatherSunnyRegular as Sun } from '@fluentui/react-icons';
import { useCdr } from '../../context/CdrContext';
import DataActions from './DataActions';
import Segmented from '../ui/Segmented';
import { COLOR_MODES } from '../../theme/colorSchemes';
import { availableDates, rangeLabel } from '../../utils/dateRange';
import { reducedMotion } from '../../utils/motion';

// The dial and the two hues it can wear, so the switch reads as the thing it changes.
// The word still has to be spoken to a screen reader, so it rides along hidden rather
// than becoming a `title=`, which a keyboard or a tap never sees.
const MODE_ICONS = { dark: Moon, light: Sun };
const MODES = Object.entries(COLOR_MODES).map(([id, mode]) => {
  const Icon = MODE_ICONS[id];
  return { id, label: <><Icon style={{ fontSize: 14 }} /><span className="sr-only">{mode.label}</span></> };
});

// Detached floating bar: 8px clear of the viewport on three sides, and lifted off
// the page by its own shadow. It reads as a different layer from the cards because
// .app-bar fills with `sunken`, not the `surface` the content uses, so it stays
// distinguishable without needing distance. Identity on the left; what is loaded, and
// which palette paints it, on the right. Below lg there is no rail, so loading a file
// comes back to the bar — the views went to the bottom bar instead — and the bar scrolls
// away with the page rather than pinning a second row of chrome over a phone screen. The
// mode switch stays in the bar at every width: it is chrome, not a setting you should
// have to visit a page for.
export default function AppHeader() {
  const { rawCalls, analysis, dateRange, colorScheme, setColorScheme } = useCdr();
  const dates = availableDates(analysis);

  // The mode switch is the one change that touches every pixel, so it gets the one
  // transition that can carry that: a circle opened at this bar's corner and grown across
  // the diagonal (geometry in index.css). flushSync is what puts the new palette on <html>
  // before the snapshot is taken — a state update alone lands after the callback returns,
  // and the reveal would wipe an unchanged page. Print's own mode flip never comes here.
  const switchMode = (next) => {
    if (next === colorScheme) return;
    if (!document.startViewTransition || reducedMotion()) return setColorScheme(next);
    document.startViewTransition(() => flushSync(() => setColorScheme(next)));
  };

  return (
    <header className="app-bar no-print z-40 mx-2 mt-2 flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3 sm:gap-4 sm:px-6 sm:py-4 lg:sticky lg:top-2">
      <div className="flex min-w-0 items-center gap-3">
        {/* The shift dial, same geometry as public/favicon.svg, drawn through the
            theme roles so it re-colours with the scheme instead of being a picture. */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-k-surface ring-1 ring-inset ring-k-hairline">
          <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
            <path d="M16 6.4A9.6 9.6 0 1 1 6.4 16" fill="none" strokeWidth="3.5" strokeLinecap="round" style={{ stroke: 'rgb(var(--k-accent-fg))' }} />
            <path d="M6.4 16A9.6 9.6 0 0 1 16 6.4" fill="none" strokeWidth="3.5" strokeLinecap="round" style={{ stroke: 'rgb(var(--k-throughput))' }} />
            <circle cx="16" cy="16" r="2.6" style={{ fill: 'rgb(var(--k-talk))' }} />
          </svg>
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold leading-tight tracking-tight text-k-ink sm:text-lg">
            CATI CDR Studio
          </h1>
          <p className="hidden truncate text-xs leading-tight text-k-ink-muted sm:block">CDR Team Rundown &amp; Shift Intelligence</p>
        </div>
      </div>

      {/* One cluster on the right, not two loose children: `justify-between` would
          otherwise push the status into the middle of an empty bar, and the height rule
          that keeps a switch the same height as its row measures siblings within the
          parent, where the 42px brand block would set the bar. */}
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
        {/* Below sm the date range already appears with the view heading and the row
            count repeats the table, so the bar keeps only the mode switch. */}
        <p className="hidden shrink-0 items-center gap-2 text-xs leading-tight text-k-ink-muted sm:flex">
          <span className="num">{rawCalls.length} calls · {rangeLabel(dateRange, dates)}</span>
        </p>
        <Segmented label="Colour mode" options={MODES} value={colorScheme} onChange={switchMode} />
      </div>

      <DataActions className="order-last w-full grid-cols-2 lg:hidden" />
    </header>
  );
}
