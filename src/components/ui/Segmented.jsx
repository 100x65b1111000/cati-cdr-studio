import React from 'react';

// Recessed track with a solid fill on the active option. A 15% tint read as
// "nothing is selected" next to the toolbar's other buttons.
// 26px not 24: the track's own 2px padding makes the group the row's 30px, so the
// active option doesn't sit taller or shorter than the buttons either side of it.
export default function Segmented({ label, options, value, onChange }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-none items-center gap-0.5 rounded bg-k-sunken/80 p-0.5 ring-1 ring-inset ring-k-hairline"
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.id)}
            className={`flex min-h-[26px] items-center rounded px-3 py-1 text-meta font-medium transition-colors active:translate-y-[1px] ${
              active
                ? 'bg-k-accent text-k-accent-ink'
                : 'hoverable text-k-ink-muted'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
