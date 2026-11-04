import React, { useMemo } from 'react';
import { useCdr } from '../../context/CdrContext';
import { availableDates, inDateRange } from '../../utils/dateRange';
import { deriveMetrics } from '../../services/metrics';
import { calculateShiftAnalysis, createShiftDateResolver } from '../../services/shiftCalculator';
import { formatDurationCompact } from '../../utils/timeFormatter';
import { COLOR_MODES } from '../../theme/colorSchemes';
import { removeFromStorage } from '../../utils/storage';
import Segmented from '../ui/Segmented';

const MODE_OPTIONS = Object.entries(COLOR_MODES).map(([id, mode]) => ({ id, label: mode.label }));

// Every key this app writes through storage.js. `raw_records` is retired (the dataset lives on
// the server now) and `color_scheme` is the old mode key, so neither belongs here.
const LOCAL_KEYS = ['ext_map', 'color_mode', 'motion', 'shift_config', 'manual_overrides', 'date_range', 'saved_views'];

const ROW = 'flex items-baseline justify-between gap-4 px-3.5 py-2';
const minutes = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

function Plate({ title, note, action, children }) {
  return (
    <section className="panel mb-3 flex break-inside-avoid flex-col overflow-hidden rounded">
      <header className="flex items-center justify-between gap-3 border-b border-k-hairline bg-k-sunken px-3.5 py-2">
        <h3 className="text-xs font-semibold text-k-ink">{title}</h3>
        <div className="flex min-w-0 items-center gap-2">
          {note && <span className="num truncate text-2xs text-k-ink-muted">{note}</span>}
          {action}
        </div>
      </header>
      {children}
    </section>
  );
}

// The 24-hour ribbon: where the shift sits in the day, and where the calls actually landed.
// Band widths and bar heights are written once per render with no ramp on them, so the plate
// costs nothing to reflow.
function ShiftWindow({ byHour, startAt, endAt, wraps }) {
  const busiest = Math.max(...byHour);
  const peak = Math.max(busiest, 1);
  const bands = wraps
    ? [
        { left: (startAt / 1440) * 100, width: 100 - (startAt / 1440) * 100 },
        { left: 0, width: (endAt / 1440) * 100 }
      ]
    : [{ left: (startAt / 1440) * 100, width: ((endAt - startAt) / 1440) * 100 }];

  return (
    <div
      role="img"
      className="relative mx-3.5 mt-2.5 h-14 overflow-hidden rounded border border-k-hairline bg-k-sunken"
      aria-label={
        busiest > 0
          ? `Calls by hour of day, ${byHour.reduce((a, b) => a + b, 0)} in this range, busiest at ${String(byHour.indexOf(busiest)).padStart(2, '0')}:00 with ${busiest}`
          : 'No calls in this date range'
      }
    >
      {bands.map((band, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="absolute inset-y-0 bottom-4 bg-k-accent-fg/10 ring-1 ring-inset ring-k-accent-fg/35"
          style={{ left: `${band.left}%`, width: `${band.width}%` }}
        />
      ))}
      <div aria-hidden="true" className="absolute inset-x-1 bottom-4 top-1.5 flex items-end gap-[2px]">
        {byHour.map((n, hour) => {
          const inShift = wraps
            ? hour * 60 >= startAt || hour * 60 < endAt
            : hour * 60 >= startAt && hour * 60 < endAt;
          return (
            <span
              key={hour}
              className={`min-w-0 flex-1 rounded-t-sm ${inShift ? 'bg-k-accent-fg' : 'bg-k-hairline-strong'}`}
              style={{ height: `${n ? Math.max((n / peak) * 100, 6) : 0}%` }}
            />
          );
        })}
      </div>
      <div className="num absolute inset-x-1.5 bottom-0.5 flex justify-between text-2xs leading-none text-k-ink-faint">
        <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
      </div>
    </div>
  );
}

export default function SettingsView() {
  const {
    shiftConfig,
    setIsSettingsOpen,
    savedViews,
    deleteSavedView,
    rawRecords,
    rawCalls,
    analysis,
    extNameMap,
    manualOverrides,
    clearManualOverride,
    activeUpload,
    uploadHistory,
    restoreUpload,
    isParsing,
    dateRange,
    colorScheme,
    setColorScheme,
    motion,
    setMotion,
    slide
  } = useCdr();

  const dates = availableDates(analysis);
  const metrics = useMemo(() => deriveMetrics(analysis, dateRange), [analysis, dateRange]);

  const agentDays = useMemo(
    () =>
      Object.values(analysis).reduce(
        (n, byDate) => n + Object.keys(byDate).filter((d) => inDateRange(d, dateRange)).length,
        0
      ),
    [analysis, dateRange]
  );

  const resolveShiftDate = useMemo(() => createShiftDateResolver(shiftConfig), [shiftConfig]);

  const byHour = useMemo(() => {
    const out = new Array(24).fill(0);
    rawCalls.forEach((call) => {
      if (inDateRange(resolveShiftDate(call.start_time), dateRange)) out[call.start_time.getHours()] += 1;
    });
    return out;
  }, [rawCalls, resolveShiftDate, dateRange]);

  // The counterfactual: two extra full calculations, so the threshold is a decision with numbers
  // beside it rather than a blind spinner. About 15ms on a 3,000-row file.
  const threshold = shiftConfig.breakThresholdMinutes;
  const steps = useMemo(
    () => Array.from(new Set([Math.max(1, threshold - 5), threshold, threshold + 5])),
    [threshold]
  );
  const counterfactual = useMemo(
    () =>
      steps.map((min) => {
        const byShift = calculateShiftAnalysis(
          rawCalls,
          extNameMap,
          { ...shiftConfig, breakThresholdMinutes: min },
          manualOverrides
        );
        let breaks = 0;
        let net = 0;
        Object.values(byShift).forEach((byDate) =>
          Object.entries(byDate).forEach(([dateStr, row]) => {
            if (!inDateRange(dateStr, dateRange)) return;
            breaks += row.breaks_count;
            net += row.net_active_sec;
          })
        );
        return { min, breaks, net };
      }),
    [steps, rawCalls, extNameMap, shiftConfig, manualOverrides, dateRange]
  );

  const overrides = useMemo(() => {
    const rows = [];
    Object.entries(manualOverrides).forEach(([key, values]) => {
      const cut = key.indexOf('_');
      if (cut < 0) return;
      const ext = key.slice(0, cut);
      const dateStr = key.slice(cut + 1);
      const typed = [];
      if (values.halfDones) typed.push(`half dones ${values.halfDones}`);
      if (values.surveys) typed.push(`surveys ${values.surveys}`);
      if (typed.length === 0) return;
      rows.push({ ext, dateStr, typed, name: extNameMap[ext] || `Extension ${ext}` });
    });
    return rows;
  }, [manualOverrides, extNameMap]);

  const seenExtensions = useMemo(() => new Set(rawCalls.map((call) => call.extension)).size, [rawCalls]);
  const mapped = Object.keys(extNameMap).length;
  const skipped = activeUpload ? activeUpload.rowCount - rawRecords.length : 0;
  const startAt = minutes(shiftConfig.shiftStartTime);
  const endAt = minutes(shiftConfig.shiftEndTime);
  const wraps = endAt <= startAt || shiftConfig.shiftEndDay > shiftConfig.shiftStartDay;

  const primary =
    'inline-flex h-[30px] shrink-0 items-center rounded bg-k-accent px-3 text-xs font-medium text-k-accent-ink transition-colors hover:bg-k-accent/90 active:translate-y-[1px]';
  const quiet =
    'hoverable inline-flex h-[30px] shrink-0 items-center rounded border border-k-hairline bg-k-surface-hover/50 px-2.5 text-xs font-medium text-k-ink-muted active:translate-y-[1px]';

  return (
    <div className={`animate__animated ${slide} gap-3 md:columns-2 xl:columns-3`}>
      <Plate
        title="Shift rules"
        action={
          <button type="button" onClick={() => setIsSettingsOpen(true)} className={primary}>
            Edit rules
          </button>
        }
      >
        <div className="divide-y divide-k-hairline">
          <div className={ROW}>
            <span className="text-xs text-k-ink-muted">Start</span>
            <span className="num text-sm font-semibold text-k-ink">
              {shiftConfig.shiftStartTime}{' '}
              <span className="text-2xs font-normal text-k-ink-muted">day {shiftConfig.shiftStartDay + 1}</span>
            </span>
          </div>
          <div className={ROW}>
            <span className="text-xs text-k-ink-muted">End</span>
            <span className="num text-sm font-semibold text-k-ink">
              {shiftConfig.shiftEndTime}{' '}
              <span className="text-2xs font-normal text-k-ink-muted">day {shiftConfig.shiftEndDay + 1}</span>
            </span>
          </div>
          <div className={ROW}>
            <span className="text-xs text-k-ink-muted">Break after</span>
            <span className="num text-sm font-semibold text-k-ink">
              {threshold} <span className="text-2xs font-normal text-k-ink-muted">min idle</span>
            </span>
          </div>
        </div>
        <ShiftWindow byHour={byHour} startAt={startAt} endAt={endAt} wraps={wraps} />
        <p className="mt-auto px-3.5 pb-3 pt-2.5 text-2xs leading-relaxed text-k-ink-muted">
          A shift that ends after midnight belongs to the day it started, so the 01:00 calls land on
          the night that made them. The rules are saved with the dataset, so every browser on this
          team computes the same numbers.
        </p>
      </Plate>

      <Plate title="What those rules produce" note={`${agentDays} agent-days in range`}>
        <div className="divide-y divide-k-hairline">
          {[
            ['Net active time', formatDurationCompact(metrics.netActiveSec), `${metrics.spanShare} of span`],
            ['Talk', formatDurationCompact(metrics.talkSec), `${metrics.talkShare} of active`],
            ['Breaks counted', metrics.breaksCount, `longest ${formatDurationCompact(metrics.longestBreakSec)}`],
            ['Calls per hour', metrics.perHour, `best ${metrics.bestHour}/h`],
            [
              'Per agent',
              formatDurationCompact(metrics.perAgentNet),
              metrics.agents ? `${(metrics.totalCalls / metrics.agents).toFixed(1)} calls` : ''
            ]
          ].map(([label, value, tail]) => (
            <div key={label} className={ROW}>
              <span className="text-xs text-k-ink-muted">{label}</span>
              <span className="num text-sm font-semibold text-k-ink">
                {value}
                {tail && <span className="ml-1.5 text-2xs font-normal text-k-ink-muted">{tail}</span>}
              </span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-x-3 gap-y-1 border-t border-k-hairline px-3.5 py-2.5">
          <span className="text-2xs text-k-ink-faint">Idle gap</span>
          <span className="num text-right text-2xs text-k-ink-faint">Breaks</span>
          <span className="num text-right text-2xs text-k-ink-faint">Net active</span>
          {counterfactual.map((c) => (
            <React.Fragment key={c.min}>
              <span className={`num text-meta ${c.min === threshold ? 'font-semibold text-k-accent-fg' : 'text-k-ink'}`}>
                {c.min} min{c.min === threshold && ' set'}
              </span>
              <span className="num text-right text-meta text-k-ink">{c.breaks}</span>
              <span className="num text-right text-meta text-k-ink">{formatDurationCompact(c.net)}</span>
            </React.Fragment>
          ))}
        </div>
        <p className="mt-auto border-t border-k-hairline px-3.5 py-2.5 text-2xs leading-relaxed text-k-ink-muted">
          The same calls counted five minutes either side of the threshold that is set. A wider gap
          hides short idles inside net active time, a narrower one turns gaps between calls into breaks.
        </p>
      </Plate>

      <Plate title="Manual overrides" note={overrides.length ? `${overrides.length} agent-days` : 'none'}>
        {overrides.length === 0 ? (
          <p className="mt-auto px-3.5 py-3 text-2xs leading-relaxed text-k-ink-muted">
            Nothing typed over the calculation. Half dones and surveys set in a rundown cell show up
            here, because they change every figure above.
          </p>
        ) : (
          <ul className="divide-y divide-k-hairline">
            {overrides.map(({ ext, dateStr, typed, name }) => (
              <li key={`${ext}_${dateStr}`} className="row-hover flex items-center justify-between gap-4 px-3.5 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-k-ink">
                    {name} <span className="num font-normal text-k-ink-muted">{ext}</span>
                  </span>
                  <span className="num block truncate text-2xs text-k-ink-muted">
                    {new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}{' '}
                    {typed.join(', ')}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => clearManualOverride(ext, dateStr)}
                  aria-label={`Clear overrides for ${name} on ${dateStr}`}
                  style={{ '--tone': 'var(--k-danger)' }}
                  className={`${quiet} hover:text-k-critical`}
                >
                  Clear
                </button>
              </li>
            ))}
          </ul>
        )}
      </Plate>

      <Plate title="Dataset" note="shared by every browser">
        <div className="divide-y divide-k-hairline">
          {[
            ['Rows read', activeUpload ? activeUpload.rowCount : rawRecords.length, skipped ? `${skipped} skipped` : ''],
            ['Valid calls', rawRecords.length, ''],
            ['Extensions mapped', mapped, `${seenExtensions} seen`],
            ['Shift days in file', dates.length, ''],
            ['Active file', activeUpload ? activeUpload.filename : 'none stored', activeUpload ? activeUpload.source : '']
          ].map(([label, value, tail]) => (
            <div key={label} className={ROW}>
              <span className="shrink-0 text-xs text-k-ink-muted">{label}</span>
              <span className="num min-w-0 truncate text-right text-sm font-semibold text-k-ink">
                {value}
                {tail && <span className="ml-1.5 text-2xs font-normal text-k-ink-muted">{tail}</span>}
              </span>
            </div>
          ))}
        </div>
        {uploadHistory.length > 0 && (
          <ul className="divide-y divide-k-hairline border-t border-k-hairline">
            {uploadHistory.map((upload) => (
              <li key={upload.id} className="row-hover flex items-center justify-between gap-4 px-3.5 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-k-ink">{upload.filename}</span>
                  <span className="num block truncate text-2xs text-k-ink-muted">
                    {upload.source}, {upload.rowCount} rows, {new Date(upload.uploadedAt).toLocaleString()}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => restoreUpload(upload.id)}
                  disabled={isParsing}
                  aria-label={`Restore ${upload.filename}`}
                  className={`${quiet} disabled:opacity-50`}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-auto border-t border-k-hairline px-3.5 py-2.5 text-2xs leading-relaxed text-k-ink-muted">
          Every browser on this team reads the same dataset, so a wrong upload is replaced here
          rather than by re-dropping the file.
        </p>
      </Plate>

      <Plate title="Saved views" note={String(savedViews.length || 'none')}>
        {savedViews.length === 0 ? (
          <p className="mt-auto px-3.5 py-3 text-2xs leading-relaxed text-k-ink-muted">
            No saved views. A view keeps the columns, filters and search you set up in the rundown.
          </p>
        ) : (
          <ul className="divide-y divide-k-hairline">
            {savedViews.map((view) => (
              <li key={view.id} className="row-hover flex items-center justify-between gap-4 px-3.5 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-k-ink">{view.name}</span>
                  <span className="num block truncate text-2xs text-k-ink-muted">
                    {Object.keys(view.filters || {}).length} filters, saved {view.createdAt}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => deleteSavedView(view.id)}
                  aria-label={`Delete ${view.name}`}
                  style={{ '--tone': 'var(--k-danger)' }}
                  className={`${quiet} hover:text-k-critical`}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </Plate>

      <Plate title="This browser">
        <div className="divide-y divide-k-hairline">
          <div className="flex items-center justify-between gap-4 px-3.5 py-2">
            <span className="text-xs text-k-ink-muted">Colour mode</span>
            <Segmented label="Colour mode" options={MODE_OPTIONS} value={colorScheme} onChange={setColorScheme} />
          </div>
          <label className="flex cursor-pointer items-center justify-between gap-4 px-3.5 py-2">
            <span className="text-xs text-k-ink-muted">Always animate view switches</span>
            <input
              type="checkbox"
              className="cbox"
              checked={motion === 'full'}
              onChange={(e) => setMotion(e.target.checked ? 'full' : 'system')}
            />
          </label>
          <div className="flex items-center justify-between gap-4 px-3.5 py-2">
            <span className="min-w-0">
              <span className="block text-xs text-k-ink-muted">Session</span>
              <span className="num block truncate text-2xs text-k-ink-muted">team password, 12 hours</span>
            </span>
            {/* A plain form post, not a fetch: the redirect is the server's, so there is no
                client-side routing to keep in step with a cookie that no longer exists. */}
            <form method="post" action="/api/auth/logout">
              <button
                type="submit"
                style={{ '--tone': 'var(--k-danger)' }}
                className={`${quiet} hover:text-k-critical`}
              >
                Sign out
              </button>
            </form>
          </div>
          <div className="flex items-center justify-between gap-4 px-3.5 py-2">
            <span className="min-w-0 text-xs text-k-ink-muted">
              Stored here only: names, overrides, saved views, mode, motion
            </span>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm('Clear what this browser has stored? The dataset and the shift rules are untouched.')) return;
                LOCAL_KEYS.forEach(removeFromStorage);
                window.location.reload();
              }}
              style={{ '--tone': 'var(--k-danger)' }}
              className={`${quiet} hover:text-k-critical`}
            >
              Clear
            </button>
          </div>
        </div>
        <p className="mt-auto border-t border-k-hairline px-3.5 py-2.5 text-2xs leading-relaxed text-k-ink-muted">
          If Windows has animation effects switched off, every transition here snaps into place in
          about a millisecond. The switch above runs them at full length in this browser, and
          nothing else.
        </p>
      </Plate>
    </div>
  );
}
