import React, { useRef, useState } from 'react';
import { ChevronDownRegular as CaretDown } from '@fluentui/react-icons';
import useDismissOverlay from '../../hooks/useDismissOverlay';

// Each popover owns a hue so the toolbar reads as distinct controls instead of
// five identical grey buttons. Same dark-pill + ring language as the metric chips.
// `hue` feeds the --tone variable the stylesheet hands to the menu, the checkboxes
// and every hover inside this wrapper, so the panel inherits the trigger's colour.
const TONE = {
  accent: { hue: 'var(--k-accent-fg)', icon: 'text-k-accent-fg', chip: 'ring-k-accent-fg/35 text-k-accent-fg', open: 'border-k-accent-fg/70 bg-k-accent-fg/10 text-k-accent-fg' },
  region: { hue: 'var(--k-region)', icon: 'text-k-region', chip: 'ring-k-region/35 text-k-region', open: 'border-k-region/70 bg-k-region/10 text-k-region' },
  throughput: { hue: 'var(--k-throughput)', icon: 'text-k-throughput', chip: 'ring-k-throughput/35 text-k-throughput', open: 'border-k-throughput/70 bg-k-throughput/10 text-k-throughput' },
  success: { hue: 'var(--k-success)', icon: 'text-k-success', chip: 'ring-k-success/35 text-k-success', open: 'border-k-success/70 bg-k-success/10 text-k-success' }
};

// `stretch` is for a trigger that lives in a stacked column — the sidebar's action
// cluster — where every other control fills its cell. The menu takes the same width,
// because a popover that hangs past a scrolling panel gets clipped by it.
// The row every popover menu paints its options with — the Agents checkboxes, the
// Columns list and the Export items all want the same plate, so it lives beside the
// wrapper that owns the tone rather than being retyped per call site.
export const menuItem =
  'hoverable flex w-full cursor-pointer items-center gap-2 rounded border border-transparent px-2.5 py-1.5 text-left text-xs text-k-ink';

// `width="w-full"` is also how a caller says the trigger fills its cell — the sidebar's
// stacked action cluster, where every other control does and a popover that hangs past
// the panel gets clipped by it.
export default function FilterPopover({
  label,
  icon: Icon,
  badge,
  children,
  width = 'w-72',
  align = 'left',
  tone = 'accent'
}) {
  const stretch = width === 'w-full';
  const t = TONE[tone] || TONE.accent;
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useDismissOverlay(() => setOpen(false), open, ref);

  return (
    <div ref={ref} className={`relative ${stretch ? 'w-full' : 'shrink-0'}`} style={{ '--tone': t.hue }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded border py-1.5 text-xs font-medium transition-colors active:translate-y-[1px] ${
          stretch ? 'h-7 w-full px-2.5' : 'px-3'
        } ${open ? t.open : 'hoverable border-k-hairline bg-k-surface-hover/50 text-k-ink-muted'}`}
      >
        {Icon && <Icon style={{ fontSize: 15 }} className={open ? '' : t.icon} />}
        <span>{label}</span>
        {badge != null && badge !== '' && (
          <span className={`num rounded px-1.5 py-0.5 text-2xs font-medium ring-1 ring-inset bg-k-sunken/70 ${t.chip}`}>
            {badge}
          </span>
        )}
        <CaretDown style={{ fontSize: 12 }} className={`ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className={`menu animate-pop-down absolute z-30 mt-1.5 rounded-md ${width} ${
            align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
