import React from 'react';
import { Trash, Sliders } from '@phosphor-icons/react';
import { useCdr } from '../../context/CdrContext';
import { COLOR_SCHEMES } from '../../theme/colorSchemes';
import { availableDates } from '../../utils/dateRange';

function Swatches({ colors }) {
  const roles = ['accent', 'success', 'danger', 'talk', 'throughput', 'break-time'];
  return (
    <div className="flex gap-1">
      {roles.map(role => (
        <span
          key={role}
          className="h-4 w-4 rounded-md border border-k-hairline"
          style={{ backgroundColor: colors[role] }}
        />
      ))}
    </div>
  );
}

export default function SettingsView() {
  const {
    colorScheme,
    setColorScheme,
    shiftConfig,
    setIsSettingsOpen,
    savedViews,
    deleteSavedView,
    rawCalls,
    extNameMap,
    analysis
  } = useCdr();

  const dates = availableDates(analysis);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <section className="panel rounded-2xl p-5 lg:col-span-2">
        <h2 className="flex items-center gap-2 border-b border-k-hairline pb-3 text-sm font-bold text-k-ink">
          <Sliders size={16} className="text-k-accent" />
          Colour scheme
        </h2>
        <p className="mt-3 text-xs text-k-ink-muted">
          Applies everywhere, including charts. Stored locally.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {Object.entries(COLOR_SCHEMES).map(([id, scheme]) => (
            <button
              key={id}
              type="button"
              onClick={() => setColorScheme(id)}
              aria-pressed={colorScheme === id}
              className={`glass-card card-hover rounded-xl p-4 text-left ${
                colorScheme === id ? 'border-k-accent ring-1 ring-inset ring-k-accent/40' : 'hover:border-k-hairline-strong'
              }`}
            >
              <span className="flex items-center justify-between">
                <span className="text-xs font-semibold text-k-ink">{scheme.label}</span>
                {colorScheme === id && <span className="text-[11px] text-k-accent">Active</span>}
              </span>
              <span className="mt-2 block">
                <Swatches colors={scheme.colors} />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel space-y-3 rounded-2xl p-5">
        <h2 className="border-b border-k-hairline pb-3 text-sm font-bold text-k-ink">Data</h2>
        <p className="num text-xs text-k-ink-muted">
          {rawCalls.length} calls across {dates.length} {dates.length === 1 ? 'date' : 'dates'}
          {dates.length > 1 && ` (${dates[0]} to ${dates[dates.length - 1]})`}
        </p>
        <h2 className="pt-2 text-sm font-bold text-k-ink">Shift rules</h2>
        <dl className="num grid gap-x-6 gap-y-1 text-xs">
          <div className="flex justify-between border-b border-k-hairline py-1">
            <dt className="text-k-ink-muted">Start</dt>
            <dd className="text-k-ink">{shiftConfig.shiftStartTime} day {shiftConfig.shiftStartDay + 1}</dd>
          </div>
          <div className="flex justify-between border-b border-k-hairline py-1">
            <dt className="text-k-ink-muted">End</dt>
            <dd className="text-k-ink">{shiftConfig.shiftEndTime} day {shiftConfig.shiftEndDay + 1}</dd>
          </div>
          <div className="flex justify-between border-b border-k-hairline py-1">
            <dt className="text-k-ink-muted">Break after</dt>
            <dd className="text-k-ink">{shiftConfig.breakThresholdMinutes} min</dd>
          </div>
          <div className="flex justify-between border-b border-k-hairline py-1">
            <dt className="text-k-ink-muted">Agents mapped</dt>
            <dd className="text-k-ink">{Object.keys(extNameMap).length}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-k-accent px-4 py-2 text-xs font-medium text-k-accent-ink transition-opacity hover:opacity-90 active:translate-y-[1px]"
        >
          <Sliders size={15} />
          Edit shift rules
        </button>
      </section>

      <section className="panel rounded-2xl p-5 lg:col-span-3">
        <h2 className="border-b border-k-hairline pb-3 text-sm font-bold text-k-ink">Saved views</h2>
        {savedViews.length === 0 ? (
          <p className="mt-3 text-xs text-k-ink-muted">
            No saved views. Save one from the Rundown toolbar.
          </p>
        ) : (
          <ul className="mt-3 max-h-72 divide-y divide-k-hairline/60 overflow-y-auto rounded-xl border border-k-hairline">
            {savedViews.map(view => (
              <li key={view.id} className="flex items-center justify-between gap-4 px-4 py-2.5 transition-colors hover:bg-k-surface-hover/40">
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-k-ink">{view.name}</span>
                  <span className="num block text-[11px] text-k-ink-muted">
                    saved {view.createdAt}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => deleteSavedView(view.id)}
                  aria-label={`Delete ${view.name}`}
                  className="shrink-0 rounded-lg p-1.5 text-k-ink-muted transition-colors hover:bg-k-danger/10 hover:text-k-critical"
                >
                  <Trash size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
