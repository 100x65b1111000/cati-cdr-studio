import React, { useState } from 'react';
import { GlyphCaretLeft as CaretLeft, GlyphCaretRight as CaretRight } from './Glyph';
import { key, pickRange, todayKey } from '../../utils/dateRange';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH = new Intl.DateTimeFormat('en', { month: 'long' });

// The browser's own picker is a different application: system-chrome the theme cannot
// reach, and it lets you land on a date the loaded file has no rows for. This is the
// same month grid in the popover language the rest of the toolbar uses, and only the
// dates that actually carry data answer the click.
export default function DateRangePicker({ dates, from, to, onPick }) {
  const [month, setMonth] = useState(() => {
    const d = new Date(`${to || from || dates[0] || todayKey()}T00:00:00`);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const [min, max] = [dates[0], dates[dates.length - 1]];
  const have = new Set(dates);
  const canPrev = !min || key(new Date(month.y, month.m, 0)) >= min;
  const canNext = !max || key(new Date(month.y, month.m + 1, 1)) <= max;
  const step = (delta) => setMonth(({ y, m }) => {
    const d = new Date(y, m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  // Monday-first, so the lead cells are the previous month's trailing days.
  const lead = (new Date(month.y, month.m, 1).getDay() + 6) % 7;
  const days = new Date(month.y, month.m + 1, 0).getDate();
  const today = todayKey();

  const pick = (iso) => onPick(...pickRange(from, to, iso));

  const nav = 'hoverable rounded border border-k-hairline p-1 text-k-ink-muted disabled:cursor-not-allowed disabled:opacity-30 active:translate-y-[1px]';

  return (
    <div className="p-2">
      <div className="flex items-center justify-between gap-2 px-1 pb-1.5">
        <button type="button" className={nav} disabled={!canPrev} onClick={() => step(-1)} aria-label="Previous month">
          <CaretLeft style={{ fontSize: 13 }} />
        </button>
        <span className="text-xs font-semibold text-k-ink">
          {MONTH.format(new Date(month.y, month.m, 1))} <span className="num text-k-ink-muted">{month.y}</span>
        </span>
        <button type="button" className={nav} disabled={!canNext} onClick={() => step(1)} aria-label="Next month">
          <CaretRight style={{ fontSize: 13 }} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px">
        {WEEKDAYS.map((d) => (
          <span key={d} className="pb-1 text-center text-2xs text-k-ink-muted">
            {d}
          </span>
        ))}
        {Array.from({ length: lead + days }, (_, i) => {
          if (i < lead) return <span key={`lead${i}`} />;
          const day = i - lead + 1;
          const iso = key(new Date(month.y, month.m, day));
          const off = have.size > 0 && !have.has(iso);
          const endpoint = iso === from || iso === to;
          const inside = !endpoint && (from || to) && (!from || iso > from) && (!to || iso < to);
          return (
            <button
              key={iso}
              type="button"
              disabled={off}
              onClick={() => pick(iso)}
              aria-label={iso}
              aria-pressed={endpoint || undefined}
              className={`num h-7 rounded text-meta leading-none ${
                off
                  ? 'cursor-not-allowed text-k-ink-muted opacity-25'
                  : endpoint
                    ? 'bg-k-accent font-semibold text-k-accent-ink'
                    : inside
                      ? 'bg-k-accent-fg/15 text-k-ink'
                      : `hover:bg-k-surface-hover text-k-ink-muted ${iso === today ? 'ring-1 ring-inset ring-k-accent-fg/60' : ''}`
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      <p className="num pt-1.5 text-center text-2xs text-k-ink-muted">
        {have.size ? `${have.size} day${have.size === 1 ? '' : 's'} with data` : 'No dates in the loaded file'}
      </p>
    </div>
  );
}
