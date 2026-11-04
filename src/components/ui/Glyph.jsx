import React from 'react';

// The five view glyphs, traced from the Basalt mockup: one 24-unit grid, one 1.8 stroke,
// `currentColor` only, no fill. Fluent's set is drawn on a 20-unit grid at a different
// weight, so a dock that mixes the two reads as two toolbars. Size and colour come from
// the same `style={{ fontSize }}` / tone-class channel the Fluent components took, so the
// call sites did not have to change.
const glyph = (shapes) =>
  function Glyph({ style, className }) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        className={className}
        style={style}
        aria-hidden="true"
      >
        {shapes}
      </svg>
    );
  };

export const GlyphRundown = glyph(<path d="M4 6h16M4 12h16M4 18h10" />);
export const GlyphRaw = glyph(<path d="M4 5h16v14H4zM4 10h16" />);
export const GlyphStats = glyph(<path d="M5 19V9m5 10V5m5 14v-7m4 7v-4" />);
export const GlyphAgents = glyph(
  <>
    <circle cx="12" cy="9" r="3" />
    <path d="M5 20c1.4-3.6 4-5 7-5s5.6 1.4 7 5" />
  </>
);
export const GlyphConfig = glyph(
  <>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 3v3m0 12v3M3 12h3m12 0h3" />
  </>
);
