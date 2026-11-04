import React from 'react';
import { useCdr } from '../../context/CdrContext';
import { NAV } from './navConfig';
import BrandMark from '../ui/BrandMark';
import { availableDates } from '../../utils/dateRange';

// The dataset card is the reference app's "Active run" panel: a switcher, then the
// facts about what is loaded. `row_count` is every CSV row the server kept and
// `rawRecords` is the ones that parsed into a call, so the difference is what got
// dropped — the number that used to only appear in the preview modal.
function DatasetCard() {
  const { activeUpload, uploadHistory, restoreUpload, isParsing, rawRecords, analysis, extNameMap } = useCdr();
  const skipped = activeUpload ? activeUpload.rowCount - rawRecords.length : 0;
  const facts = [
    [activeUpload?.rowCount ?? 0, 'rows read'],
    [rawRecords.length, 'valid calls'],
    [skipped, 'skipped'],
    [Object.keys(extNameMap).length, 'extensions'],
    [availableDates(analysis).length, 'shift days'],
    [activeUpload?.source === 'demo' ? 'sample' : activeUpload?.source || '-', 'source']
  ];

  return (
    // One step down from the opened column's `surface`, so the switcher and its figures
    // read as one plate laid on the flyout rather than a hole cut into it.
    <div className="flex flex-col gap-3 rounded-md border border-k-hairline bg-k-sunken p-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-2xs font-medium text-k-ink-faint">Active dataset</span>
        {/* One native select does the whole job: the live upload is the selected
            option, the retained ones are what you can go back to. */}
        <select
          aria-label="Choose a dataset"
          value={activeUpload?.id ?? ''}
          onChange={(event) => event.target.value && restoreUpload(Number(event.target.value))}
          disabled={isParsing || uploadHistory.length === 0}
          className="field w-full rounded px-2 py-1.5 text-meta text-k-ink disabled:opacity-60"
        >
          <option value={activeUpload?.id ?? ''}>{activeUpload ? activeUpload.filename : 'No upload stored'}</option>
          {uploadHistory.map((upload) => (
            <option key={upload.id} value={upload.id}>
              {upload.filename} - {upload.rowCount} rows
            </option>
          ))}
        </select>
      </div>

      <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-2xs">
        {facts.map(([value, label]) => (
          <React.Fragment key={label}>
            <dt className="text-k-ink-faint">{label}</dt>
            <dd className="num truncate text-right text-k-ink-muted">{value}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}

// The dock. 72px of icon, name and hotkey per view, welded to the app bar's geometry: the
// same 8px off the left edge, the same `sunken` fill, the same air above it as below. It
// opens to the right on hover — and on focus only once that focus lands inside the column
// itself, since a click in the nav leaves it on the row that was pressed. The column it
// opens into floats over the canvas
// — nothing reflows to make room, so the table never shifts under the pointer. The dataset
// switcher, its figures and the shift rules live in that opened column; the switcher that
// answers keys all day stays on the strip where it is always visible. There is no collapsed
// state to remember: 72px is the width, and opening is the interaction.
export default function AppSidebar() {
  const { activeTab, setActiveTab, shiftConfig, activeUpload } = useCdr();
  const shift = `${shiftConfig.shiftStartTime} → ${shiftConfig.shiftEndTime}${
    shiftConfig.shiftEndDay > shiftConfig.shiftStartDay ? ' +1' : ''
  }`;

  return (
    <aside className="app-bar rail no-print fixed bottom-2 left-2 under-bar z-40 hidden w-[4.5rem] flex-col gap-1.5 rounded-xl px-2 pb-2 pt-2.5 lg:flex">
      <span className="mx-auto grid h-10 w-10 shrink-0 place-items-center rounded-md border border-k-hairline bg-k-page/60">
        <BrandMark size={22} />
      </span>

      {/* The scroll is on the nav, never on the aside: a panel that both clips and paints
          is where a focus ring or an overflowed label disappears, and an `overflow-hidden`
          aside would cut the opened column off at its own edge. A short window is the only
          thing that reaches this, and then the rows scroll inside their own box. */}
      <nav aria-label="Views" className="flex min-h-0 w-full flex-1 flex-col justify-center overflow-y-auto">
        <ul className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active = activeTab === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  aria-current={active ? 'page' : undefined}
                  aria-label={`${item.label} (${item.hotkey})`}
                  className={`relative flex min-h-[3.25rem] w-full flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 pb-1 pt-2.5 text-2xs font-medium transition-colors ${
                    active ? 'bg-k-accent-fg/15 text-k-accent-fg' : 'hoverable text-k-ink-muted'
                  }`}
                >
                  <item.Icon style={{ fontSize: 16 }} className="shrink-0" />
                  <span className="w-full truncate leading-tight">{item.label}</span>
                  {/* The hotkey rides the corner rather than the row's end: at 56px of
                      column there is no trailing space left, and the digit belongs to the
                      key it is drawn on anyway. */}
                  <kbd
                    className={`num absolute right-0.5 top-0.5 rounded border px-1 text-2xs leading-tight ${
                      active ? 'border-k-accent-fg/40 text-k-accent-fg' : 'border-k-hairline text-k-ink-faint'
                    }`}
                  >
                    {item.hotkey}
                  </kbd>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Which file the strip is describing, at the foot, in the place the reference app
          put its own status plate. The name is one hover away in the opened column. */}
      <p className="num w-full truncate border-t border-k-hairline pt-1.5 text-center text-2xs leading-tight text-k-ink-faint">
        {activeUpload?.source === 'demo' ? 'sample' : activeUpload ? 'loaded' : '—'}
      </p>

      {/* The column starts 1px inside the dock's right border so the two plates share that
          edge rather than draw it twice, and the stylesheet squares the dock's top-right
          corner while it is up. It still hugs what it has to say and is capped by the dock,
          so it reads as a wing, not a shaft of empty surface. The filename is not repeated
          here: the switcher's selected option already is the filename. */}
      <div className="rail-fly pointer-events-none absolute left-full top-0 flex max-h-full w-60 flex-col gap-3 overflow-y-auto rounded-r-xl border border-l-0 border-k-hairline bg-k-surface p-3 opacity-0 shadow-[var(--shadow-16)] transition-opacity duration-[140ms] ease-linear">
        <DatasetCard />

        <p className="text-2xs leading-relaxed text-k-ink-faint">
          break {shiftConfig.breakThresholdMinutes} min · {shift}
        </p>
      </div>
    </aside>
  );
}
