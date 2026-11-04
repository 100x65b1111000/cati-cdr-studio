import React from 'react';
import { flushSync } from 'react-dom';
import { GlyphMoon as Moon, GlyphSun as Sun } from '../ui/Glyph';
import { useCdr } from '../../context/CdrContext';
import DataActions from './DataActions';
import BrandMark from '../ui/BrandMark';
import Segmented from '../ui/Segmented';
import { COLOR_MODES } from '../../theme/colorSchemes';
import { availableDates, rangeLabel } from '../../utils/dateRange';
import { reducedMotion } from '../../utils/motion';

// The two hues the switch can wear, so it reads as the thing it changes. The word still
// has to be spoken to a screen reader, so it rides along hidden rather than becoming a
// `title=`, which a keyboard or a tap never sees.
const MODE_ICONS = { dark: Moon, light: Sun };
const MODES = Object.entries(COLOR_MODES).map(([id, mode]) => {
  const Icon = MODE_ICONS[id];
  return { id, label: <><Icon style={{ fontSize: 14 }} /><span className="sr-only">{mode.label}</span></> };
});

// Detached floating bar: 8px clear of the viewport on three sides, and lifted off
// the page by its own shadow. It reads as a different layer from the cards because
// .app-bar fills with `sunken`, not the `surface` the content uses, so it stays
// distinguishable without needing distance. Identity on the left; what is loaded, and
// which palette paints it, on the right. Loading a file stays in the bar at every
// width — below lg the dock is gone, so the bar is the only place left that never asks
// for a hover over 72px of icons. The views went to the bottom bar instead, because a
// phone cannot carry a second row of nav up top. The mode switch stays here too: it is
// chrome, not a setting you should have to visit a page for.
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
        {/* The headset, same geometry as public/favicon.svg, drawn through the theme
            roles so it re-colours with the scheme instead of being a picture. */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-k-page/60 ring-1 ring-inset ring-k-hairline">
          <BrandMark size={26} />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold leading-tight tracking-tight text-k-ink sm:text-lg">
            CATI CDR Studio
          </h1>
          {/* The tagline is what the bar says about itself; the range is what the bar
              says about the data. A phone has room for one second line and it is the
              one that changes — below sm the table's own heading counts the dates
              ("1 of 1"), it does not name them. */}
          <p className="num truncate text-xs leading-tight text-k-ink-muted sm:hidden">
            {rawCalls.length} calls · {rangeLabel(dateRange, dates)}
          </p>
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
        {/* The data actions live here at every width, as they do in the mockup's header:
            loading a file is the one thing the app is for, and it should not wait on a
            hover over a 72px dock. */}
        <DataActions className="grid-flow-col auto-cols-max gap-2" />
        <Segmented label="Colour mode" options={MODES} value={colorScheme} onChange={switchMode} />
      </div>
    </header>
  );
}
