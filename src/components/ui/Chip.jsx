import React from 'react';

// Dark pill with the hue carried by ring + text only. A role-tinted fill lifted the
// surface enough to drop the accent and region labels under AA at 10px.
const CHIP = 'num whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset';

const TONE = {
  accent: 'ring-k-accent/35 text-k-accent',
  success: 'ring-k-success/35 text-k-success',
  talk: 'ring-k-talk/35 text-k-talk',
  'break-time': 'ring-k-break-time/35 text-k-break-time',
  throughput: 'ring-k-throughput/35 text-k-throughput',
  region: 'ring-k-region/35 text-k-region',
  danger: 'ring-k-danger/35 text-k-danger'
};

export default function Chip({ tone = 'accent', children }) {
  return <span className={`bg-k-sunken/70 ${CHIP} ${TONE[tone]}`}>{children}</span>;
}
