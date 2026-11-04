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
        strokeLinejoin="round"
        className={className}
        style={style}
        aria-hidden="true"
      >
        {shapes}
      </svg>
    );
  };

// A dot is the one thing a stroke cannot draw, so the grip fills.
const dot = (cx, cy) => <circle cx={cx} cy={cy} r="1.15" fill="currentColor" stroke="none" />;

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

// The rest of the set, on the same grid and weight, replacing Fluent's 20-unit filled
// icons everywhere outside the dock. Call sites keep the `style={{ fontSize }}` and
// tone-class channel they already used.
export const GlyphCaretDown = glyph(<path d="m7 10 5 5 5-5" />);
export const GlyphCaretUp = glyph(<path d="m7 14 5-5 5 5" />);
export const GlyphCaretLeft = glyph(<path d="M14.5 6.5 9.5 12l5 5.5" />);
export const GlyphCaretRight = glyph(<path d="m9.5 6.5 5 5.5-5 5.5" />);
export const GlyphCaretDoubleLeft = glyph(<path d="M12 6.5 7 12l5 5.5M18.5 6.5 13.5 12l5 5.5" />);
export const GlyphCaretDoubleRight = glyph(<path d="m12 6.5 5 5.5-5 5.5M5.5 6.5l5 5.5-5 5.5" />);
export const GlyphX = glyph(<path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />);
export const GlyphSearch = glyph(
  <>
    <circle cx="10.8" cy="10.8" r="6.3" />
    <path d="m15.6 15.6 4.2 4.2" />
  </>
);
export const GlyphCheckCircle = glyph(
  <>
    <circle cx="12" cy="12" r="8" />
    <path d="m8.4 12.2 2.6 2.6 4.6-5.2" />
  </>
);
export const GlyphXCircle = glyph(
  <>
    <circle cx="12" cy="12" r="8" />
    <path d="m9.6 9.6 4.8 4.8M14.4 9.6l-4.8 4.8" />
  </>
);
export const GlyphInfo = glyph(
  <>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 11.4v4.8M12 8.2h.01" />
  </>
);
export const GlyphWarningCircle = glyph(
  <>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7.8v5M12 15.8h.01" />
  </>
);
export const GlyphEye = glyph(
  <>
    <path d="M2.9 12c3.1-4.3 6-6.2 9.1-6.2s6 1.9 9.1 6.2c-3.1 4.3-6 6.2-9.1 6.2s-6-1.9-9.1-6.2Z" />
    <circle cx="12" cy="12" r="2.9" />
  </>
);
export const GlyphTrash = glyph(
  <path d="M4.5 7h15M9 7V4.6h6V7M6.6 7l.9 12.4h9l.9-12.4M10 10.6v5.6M14 10.6v5.6" />
);
export const GlyphSave = glyph(
  <>
    <path d="M5 4.6h10.4L19.4 8.6V19.4H5Z" />
    <path d="M8.6 4.6V9h6.4V4.6M8.6 13.6h6.8v5.8H8.6z" />
  </>
);
export const GlyphTimer = glyph(
  <>
    <circle cx="12" cy="13.6" r="7" />
    <path d="M12 10.6v3.4l2.4 1.8M9.6 3.4h4.8M12 3.4v3.2" />
  </>
);
export const GlyphCalendar = glyph(
  <path d="M4.5 6.6h15v13.2h-15zM8.5 4v4.4M15.5 4v4.4M4.5 10.8h15" />
);
export const GlyphPrinter = glyph(
  <path d="M7 9V4.6h10V9M4.4 9h15.2v7h-3.2v4.4H7.6V16H4.4zM17 12.4h.01" />
);
export const GlyphUpload = glyph(<path d="M12 16.4V4.6M7.4 9.2 12 4.6l4.6 4.6M4.6 19.4h14.8" />);
export const GlyphCode = glyph(
  <path d="M9.2 4.4C6.9 4.4 6.4 6.3 6.4 8.4s0 3.1-2 3.6c2 .5 2 1.5 2 3.6s.5 4 2.8 4M14.8 4.4c2.3 0 2.8 1.9 2.8 4s0 3.1 2 3.6c-2 .5-2 1.5-2 3.6s-.5 4-2.8 4" />
);
export const GlyphColumns = glyph(<path d="M4.5 5h15v14h-15zM9.5 5v14M14.5 5v14" />);
export const GlyphGrip = glyph(
  <>
    {dot(8, 9.6)}
    {dot(12, 9.6)}
    {dot(16, 9.6)}
    {dot(8, 14.4)}
    {dot(12, 14.4)}
    {dot(16, 14.4)}
  </>
);
export const GlyphMoon = glyph(<path d="M20.4 14.8A8.8 8.8 0 0 1 9.2 3.6 8.8 8.8 0 1 0 20.4 14.8Z" />);
export const GlyphSun = glyph(
  <>
    <circle cx="12" cy="12" r="4.4" />
    <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7" />
  </>
);
export const GlyphHistory = glyph(
  <>
    <path d="M4.4 8.6A8 8 0 1 0 12 4" />
    <path d="M4 4v4.8h4.8M12 8.4V12l2.8 1.8" />
  </>
);
export const GlyphPlay = glyph(<path d="M8.6 5.6v12.8L19.4 12Z" />);
const fileMark = (mark) =>
  glyph(
    <>
      <path d="M6.4 3.6h7.2l4 4v12.8H6.4Z" />
      <path d="M13.6 3.6v4h4" />
      {mark}
    </>
  );
export const GlyphFileCsv = fileMark(<path d="M9 12.6h6M9 15.4h6M9 18.2h4" />);
export const GlyphFileXls = fileMark(<path d="m9.2 13.4 5.6 5.4M14.8 13.4l-5.6 5.4" />);
export const GlyphUser = GlyphAgents;
