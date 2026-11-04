import React from 'react';

// The CATI operator's headset, drawn through the theme roles so it re-colours with the
// mode instead of being a picture: the band is the brand stroke, the earcups the brand
// fill, and the mic tip takes `throughput` — the hue the rundown uses for calls per hour,
// which is the one thing a headset exists to make. Same geometry as public/favicon.svg.
export default function BrandMark({ size = 30, className = '' }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <path
        d="M8.5 18.5V15a7.5 7.5 0 0 1 15 0v3.5"
        strokeWidth="2.8"
        strokeLinecap="round"
        style={{ stroke: 'rgb(var(--k-accent-fg))' }}
      />
      <rect x="6.4" y="17.4" width="4.4" height="7" rx="2.1" style={{ fill: 'rgb(var(--k-accent))' }} />
      <rect x="21.2" y="17.4" width="4.4" height="7" rx="2.1" style={{ fill: 'rgb(var(--k-accent))' }} />
      <path
        d="M23.4 24.4v.6a2.6 2.6 0 0 1-2.6 2.6h-2.3"
        strokeWidth="2.4"
        strokeLinecap="round"
        style={{ stroke: 'rgb(var(--k-accent-fg))' }}
      />
      <circle cx="16.4" cy="27.6" r="1.7" style={{ fill: 'rgb(var(--k-throughput))' }} />
    </svg>
  );
}
