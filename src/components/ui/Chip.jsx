import React from 'react';

// The one pill primitive. Neutral fill with the hue carried by ring + text only — a
// role-tinted fill lifts the surface enough to drop the label under AA at 10px, and
// it is the fill, not the text, that has to stay neutral. `tone` picks the hue; the
// text is never alpha-diluted, because `/70` on a 10px label measured 2.6:1.
const SIZE = { sm: 'text-2xs', md: 'text-meta' };

const TONE = {
  accent: 'ring-k-accent-fg/35 text-k-accent-fg',
  success: 'ring-k-success/35 text-k-success',
  danger: 'ring-k-danger/35 text-k-danger',
  talk: 'ring-k-talk/35 text-k-talk',
  throughput: 'ring-k-throughput/35 text-k-throughput',
  'break-time': 'ring-k-break-time/35 text-k-break-time',
  region: 'ring-k-region/35 text-k-region',
  neutral: 'ring-k-hairline text-k-ink-muted'
};

export default function Chip({ tone = 'accent', size = 'sm', className = '', children, ...rest }) {
  return (
    <span
      {...rest}
      className={`num whitespace-nowrap rounded bg-k-sunken/70 px-2 py-0.5 font-medium ring-1 ring-inset ${SIZE[size]} ${TONE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
