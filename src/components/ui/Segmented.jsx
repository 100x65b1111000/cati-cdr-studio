import React, { useLayoutEffect, useRef } from 'react';

// Recessed track with a solid fill on the active option. A 15% tint read as
// "nothing is selected" next to the toolbar's other buttons.
// 26px not 24: the track's own 2px padding makes the group the row's 30px, so the
// active option doesn't sit taller or shorter than the buttons either side of it.
export default function Segmented({ label, options, value, onChange }) {
  const track = useRef(null);
  const pill = useRef(null);

  // One fill that travels between the options instead of two that trade places, because
  // a switch that only changes colour in place reads as a freeze. The geometry comes
  // from the active button's own box: the options are content-sized, so no fixed step
  // would land the pill on the right edge. The pill is a fixed-width bar stretched to
  // that width rather than a bar whose width is written, because `width` is a layout
  // property and every frame of it re-flowes the row; `scaleX` is a paint. Written
  // straight to the node, since a state copy would re-render every group for a number
  // nothing else reads.
  useLayoutEffect(() => {
    const btns = [...(track.current?.querySelectorAll('button') || [])];
    const btn = btns[options.findIndex((o) => o.id === value)];
    if (!btn || !pill.current) return;
    const t = track.current.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    // The bar is sized once, to the widest option, before the first paint. Every move
    // after that is a translate and a squash of that bar, never a width write: `width`
    // is a layout property and a frame of it re-flowes the row, `scaleX` is a paint.
    if (!pill.current.style.width) {
      pill.current.style.width = `${Math.max(...btns.map((n) => n.getBoundingClientRect().width))}px`;
    }
    pill.current.style.transform = `translateX(${b.left - t.left}px) scaleX(${b.width / parseFloat(pill.current.style.width)})`;
  }, [value, options]);

  return (
    <div
      ref={track}
      role="group"
      aria-label={label}
      className="relative flex flex-none items-center gap-0.5 rounded bg-k-sunken/80 p-0.5 ring-1 ring-inset ring-k-hairline"
    >
      {/* `left-0` plus a translate, because the track's border box is where `offsetLeft`
          starts counting and the ring is a shadow, not a border. `origin-left` so the
          squash shortens the trailing edge and the leading edge stays put. */}
      <span
        ref={pill}
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0.5 left-0 w-0 origin-left rounded bg-k-accent transition-transform duration-200 ease-out"
      />
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.id)}
            className={`relative flex min-h-[26px] items-center rounded px-3 py-1 text-meta font-medium transition-colors active:translate-y-[1px] ${
              active ? 'text-k-accent-ink' : 'hoverable text-k-ink-muted'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
