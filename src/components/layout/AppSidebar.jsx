import React from 'react';
import { useCdr } from '../../context/CdrContext';
import { NAV } from './navConfig';
import DataActions from './DataActions';
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
    [activeUpload?.source === 'demo' ? 'sample' : activeUpload?.source || '—', 'source']
  ];

  return (
    // One step up from the panel's `sunken`, so it reads as a plate on the dark column
    // rather than a hole in it: the panel is now the deepest layer the sidebar owns.
    <div className="flex flex-col gap-3 rounded-xl border border-k-hairline bg-k-page/60 p-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-2xs font-medium uppercase tracking-wide text-k-ink-faint">Active dataset</span>
        {/* One native select does the whole job: the live upload is the selected
            option, the retained ones are what you can go back to. */}
        <select
          aria-label="Choose a dataset"
          value={activeUpload?.id ?? ''}
          onChange={(event) => event.target.value && restoreUpload(Number(event.target.value))}
          disabled={isParsing || uploadHistory.length === 0}
          className="field w-full rounded-lg px-2 py-1.5 text-meta text-k-ink disabled:opacity-60"
        >
          <option value={activeUpload?.id ?? ''}>{activeUpload ? activeUpload.filename : 'No upload stored'}</option>
          {uploadHistory.map((upload) => (
            <option key={upload.id} value={upload.id}>
              {upload.filename} — {upload.rowCount} rows
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

export default function AppSidebar() {
  const { activeTab, setActiveTab, shiftConfig } = useCdr();
  const shift = `${shiftConfig.shiftStartTime} → ${shiftConfig.shiftEndTime}${
    shiftConfig.shiftEndDay > shiftConfig.shiftStartDay ? ' +1' : ''
  }`;

  return (
    // The app bar's own geometry, repeated: 8px off the left edge and 8px of air at
    // both ends of the vertical run (`under-bar` parks it clear of the bar). `app-bar`
    // rather than `panel` so it is the same sunken layer as the bar instead of a card
    // lifted out of the content. It costs the content 19.5rem.
    <aside className="app-bar no-print fixed bottom-2 left-2 under-bar z-40 hidden w-72 flex-col overflow-hidden rounded-2xl lg:flex">
      {/* The scroll is on the inside, never on the aside itself: a panel that both
          clips and paints is where a focus ring or an overflowed label disappears. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <nav aria-label="Views">
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
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-meta font-medium transition-colors ${
                      active ? 'bg-k-accent/15 text-k-accent' : 'hoverable text-k-ink-muted'
                    }`}
                  >
                    <item.Icon size={16} weight={active ? 'fill' : 'regular'} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                    <kbd
                      className={`num ml-auto shrink-0 rounded-[4px] border px-1.5 text-2xs ${
                        active ? 'border-k-accent/40 text-k-accent' : 'border-k-hairline text-k-ink-muted'
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

        {/* `mt-auto` lives here rather than on the card so the whole data cluster — load,
            switch, read — travels to the foot together. */}
        <DataActions className="mt-auto grid-cols-1" />

        <DatasetCard />

        <p className="text-2xs leading-relaxed text-k-ink-faint">
          break {shiftConfig.breakThresholdMinutes} min · {shift}
        </p>
      </div>
    </aside>
  );
}
