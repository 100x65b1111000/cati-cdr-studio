import React from 'react';
import { Calendar } from '@phosphor-icons/react';
import FilterPopover from './FilterPopover';

// A range that covers several shifts is ambiguous the moment a view aggregates it,
// so every view that does gets the same escape hatch: pick one shift, or stay on all
// of them. Hidden below two shifts, because on a single-day file it is noise.
export default function DayScopeSelect({ days, value, onChange }) {
  if (days.length < 2) return null;
  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <FilterPopover label={value || 'All dates'} icon={Calendar} width="w-56">
        <div className="max-h-72 space-y-0.5 overflow-y-auto p-2">
          <Option
            active={!value}
            onClick={() => onChange('')}
            label="All dates"
            hint={`${days.length} shifts`}
          />
          {days.map((d) => (
            <Option key={d.date} active={value === d.date} onClick={() => onChange(d.date)} label={d.date} hint={d.hint} />
          ))}
        </div>
      </FilterPopover>
      <p className="text-meta text-k-ink-muted">{value ? 'One shift only.' : `${days.length} shifts in range.`}</p>
    </div>
  );
}

// Single-select, so a tick would be decoration: the picked day carries the popover's
// own tone, the same open-state language the toolbar triggers use.
function Option({ active, onClick, label, hint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label}, ${hint}`}
      className={`flex w-full items-center justify-between gap-3 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors active:translate-y-[1px] ${
        active ? 'border-k-accent/70 bg-k-accent/10 text-k-accent' : 'hoverable border-transparent text-k-ink'
      }`}
    >
      <span className="num">{label}</span>
      <span className="num text-2xs text-k-ink-muted">{hint}</span>
    </button>
  );
}
