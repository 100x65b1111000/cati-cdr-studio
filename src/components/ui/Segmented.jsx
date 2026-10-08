import React from 'react';

// Recessed track with a solid thumb. A 15% tint on the active option read as
// "nothing is selected" next to the toolbar's other buttons.
export default function Segmented({ label, options, value, onChange }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-none items-center gap-0.5 rounded-lg bg-k-sunken/80 p-0.5 ring-1 ring-inset ring-k-hairline-strong/50"
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.id)}
            className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors active:translate-y-[1px] ${
              active
                ? 'bg-k-accent text-k-accent-ink'
                : 'text-k-ink-muted hover:bg-k-surface-hover/70 hover:text-k-ink'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
