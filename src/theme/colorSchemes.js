// Single source of truth for the two colour modes: the Basalt palette, as hex literals
// written here and nowhere else. Role keys are kebab-case and map 1:1 to the Tailwind `k`
// color keys, so a role reads the same in JSX (`bg-k-surface-hover`) and as a CSS variable
// (`--k-surface-hover`). The active mode is applied as `--k-<role>` on <html> by CdrContext
// and by the pre-paint sheet in app/layout.jsx.
//
// The values were solved, not picked: each one is the sRGB of an oklch triple chosen so
// that the floors `ui-check.mjs` asserts hold in both modes — AA 4.5 for every text role on
// the card, 3:1 for a control edge, ΔE 20 across the pairs that share a word, ΔE 25 across
// the six chart series, the two elevation gaps. Edit a hex here and checkPalette fails on
// the pair it broke. These are no longer Microsoft Fluent's tokens: the palette stops
// moving with `npm update`, and gains a graphite base with one electric cyan in it.
//
// `accent` is the brand *fill*, `accent-fg` the brand *text/stroke*. Light needs two cyans:
// #007491 is dark enough to carry near-white ink, #006e8b is the legible edge and link.
// Dark gets by with one, because a solid cyan button takes the mode's own ink (`accent-ink`
// #001722) rather than white.
//
// `danger` = a bad call outcome (missed / not answered). `critical` = required-field and
// destructive-action marking. They must never share a hex, or the two meanings collapse
// into one colour — and in dark that pushes `critical` to the orange side of red, since two
// reds would sit inside each other's ΔE tolerance.
//
// `warning` is a metric hue, not an alert: it marks the call rate, which is neither
// destructive (`critical`) nor a failed call (`danger`). ui-check holds it 20+ ΔE from
// `throughput` so the rate figure and its chart series never read as one colour.
//
// `ink-faint` is the third text level — separators, dashes, the dimmest live figures — and
// clears AA 4.5 on its own mode's card rather than sitting a fixed step below `ink-muted`.
//
// Elevation deepens downward: well < page < card < hover. Dark sits at L* 2.7 on the page,
// where contrast ratios compress to nothing, so the bar and the dock separate from the
// canvas with a hairline and a shadow; `sunken` against `surface` still carries the 1.15x
// that tells the floating chrome apart from the cards it floats over.
export const DEFAULT_MODE = 'dark';

// Solved by `.hallmark/palette.mjs`; the two oklch ramps are in that file, the hex is here.
const PALETTE = {
  dark: {
    page: '#090a0d',
    sunken: '#020304',
    surface: '#191b1e',
    // The row wash, two steps off the card: ui-check wants ΔL* 5 between the two or a
    // hovered row is the row it replaces.
    'surface-hover': '#26292e',
    hairline: '#3d4045',
    // The edge of a control you type into or tick, which has to clear 3:1 against both
    // neighbours on its own (WCAG 1.4.11): the card outside and the well inside it.
    'hairline-strong': '#71747c',
    ink: '#f0f2f4',
    'ink-muted': '#c8cace',
    'ink-faint': '#9b9ea5',
    accent: '#45dcfc',
    'accent-ink': '#001722',
    'accent-fg': '#45dcfc',
    success: '#a3cf68',
    danger: '#ff6e70',
    critical: '#ff9e6d',
    warning: '#ffc27f',
    talk: '#5dd0a9',
    throughput: '#cfa508',
    'break-time': '#ce81e5',
    region: '#94abff'
  },
  light: {
    page: '#e6e8eb',
    sunken: '#d5d7dd',
    surface: '#fdfdff',
    'surface-hover': '#ebedf1',
    hairline: '#d2d4d8',
    'hairline-strong': '#6e7279',
    ink: '#1d1f24',
    'ink-muted': '#4a4d54',
    'ink-faint': '#656971',
    accent: '#007491',
    'accent-ink': '#f6f9fa',
    'accent-fg': '#006e8b',
    success: '#4b7100',
    danger: '#b7162d',
    critical: '#b43a00',
    warning: '#b45600',
    talk: '#007151',
    throughput: '#825d00',
    'break-time': '#883e9d',
    region: '#495ab2'
  }
};

export const COLOR_MODES = {
  dark: { label: 'Dark', colors: PALETTE.dark },
  light: { label: 'Light', colors: PALETTE.light }
};

// Chart series resolve through roles, so neither mode needs a second colour list to drift.
export const SERIES_ROLES = ['accent-fg', 'talk', 'throughput', 'break-time', 'success', 'danger'];

export function cssVarName(role) {
  return '--k-' + role.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}

export function hexToRgbTriplet(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

// Tolerates an unknown or legacy id: the persisted value is user-controlled state,
// and a colour lookup that throws takes the whole app down with it.
export function getMode(id) {
  return COLOR_MODES[id] || COLOR_MODES[DEFAULT_MODE];
}

// Canvas fills need concrete colour strings, so charts read the variables the
// active mode already wrote on <html>. The mode object stays out of the
// render path and the canvas always matches what the DOM shows.
export function themeColor(role, alpha = 1) {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(cssVarName(role))
    .trim();
  const parts = raw.split(/[\s,/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return 'transparent';
  return alpha >= 1
    ? `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`
    : `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
}

export function themeSeries(count = SERIES_ROLES.length) {
  return SERIES_ROLES.slice(0, count).map((role) => themeColor(role));
}
