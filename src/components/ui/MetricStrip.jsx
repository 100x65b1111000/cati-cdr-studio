import React from 'react';
import Chip from './Chip';

// The Basalt tile: the label, the figure at 24px of mono, and its two facts pinned to
// the bottom edge. There is no icon plate any more — the mockup's tiles carry none, and
// the hue the plate used to paint is still here, on the chips that need it. `role` is
// what an unlabelled chip takes.
export default function MetricStrip({ items }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {items.map(({ label, value, chips = [], role = 'accent' }) => (
        <div key={label} className="panel lift flex flex-col rounded p-3.5">
          <div className="text-xs font-medium text-k-ink-muted">{label}</div>
          {/* The value is nowrap, so at two cards per column on a phone it is the
              figure's own size that has to give, not the tile's. */}
          <div className="num mt-1.5 whitespace-nowrap text-xl font-semibold leading-none text-k-ink sm:text-2xl">
            {value}
          </div>
          {chips.length > 0 && (
            <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
              {/* A long region name used to run under the card's edge and get sliced;
                  ellipsis keeps the chip inside it. */}
              {chips.map(({ text, tone = role }) => (
                <Chip key={text} tone={tone} className="max-w-full truncate">
                  {text}
                </Chip>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
