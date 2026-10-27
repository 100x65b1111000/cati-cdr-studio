import React, { useEffect, useRef, useState } from 'react';
import { CaretDown } from '@phosphor-icons/react';

// Each popover owns a hue so the toolbar reads as distinct controls instead of
// five identical grey buttons. Same dark-pill + ring language as the metric chips.
// `hue` feeds the --tone variable the stylesheet hands to the menu, the checkboxes
// and every hover inside this wrapper, so the panel inherits the trigger's colour.
const TONE = {
  accent: { hue: 'var(--k-accent)', icon: 'text-k-accent', chip: 'ring-k-accent/35 text-k-accent', open: 'border-k-accent/70 bg-k-accent/10 text-k-accent' },
  region: { hue: 'var(--k-region)', icon: 'text-k-region', chip: 'ring-k-region/35 text-k-region', open: 'border-k-region/70 bg-k-region/10 text-k-region' },
  throughput: { hue: 'var(--k-throughput)', icon: 'text-k-throughput', chip: 'ring-k-throughput/35 text-k-throughput', open: 'border-k-throughput/70 bg-k-throughput/10 text-k-throughput' },
  success: { hue: 'var(--k-success)', icon: 'text-k-success', chip: 'ring-k-success/35 text-k-success', open: 'border-k-success/70 bg-k-success/10 text-k-success' }
};

export default function FilterPopover({
  label,
  icon: Icon,
  badge,
  children,
  width = 'w-72',
  align = 'left',
  tone = 'accent'
}) {
  const t = TONE[tone] || TONE.accent;
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onMouseDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0" style={{ '--tone': t.hue }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors active:translate-y-[1px] ${
          open ? t.open : 'hoverable border-k-hairline-strong bg-k-surface-hover/50 text-k-ink-muted'
        }`}
      >
        {Icon && <Icon size={15} className={open ? '' : t.icon} />}
        <span>{label}</span>
        {badge != null && badge !== '' && (
          <span className={`num rounded-md px-1.5 py-0.5 text-2xs font-medium ring-1 ring-inset bg-k-sunken/70 ${t.chip}`}>
            {badge}
          </span>
        )}
        <CaretDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className={`menu animate-pop-down absolute z-30 mt-1.5 rounded-xl ${width} ${
            align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
