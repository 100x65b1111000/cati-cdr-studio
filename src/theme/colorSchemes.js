// Single source of truth for the two colour modes. The values are Microsoft Fluent's
// official web tokens (`@fluentui/react-theme`), named here rather than typed: a role
// records which token it takes, so the palette cannot drift away from the system it
// claims to be, and `npm update` moves the app with it.
//
// Role keys are kebab-case and map 1:1 to the Tailwind `k` color keys, so a role reads
// the same in JSX (`bg-k-surface-hover`) and as a CSS variable (`--k-surface-hover`).
// The active mode is applied as `--k-<role>` variables on <html> by CdrContext.
//
// `accent` is the brand *fill* (colorBrandBackground) and `accent-fg` is the brand
// *text/stroke* (colorBrandForeground1). Fluent separates them because no single blue is
// both: dark's fill #115EA3 is for white type on it, and only the foreground #479EF5 is
// legible as a link or an edge on the card. Anything painted as ink, hairline or wash
// takes `accent-fg`; solid buttons take `accent` with `accent-ink`.
//
// `danger` = a bad call outcome (missed / not answered). `critical` = required-field
// and destructive-action marking. They must never share a hex, or the two meanings
// collapse into one colour — and in dark they cannot both be red: Fluent's own dark
// danger text (#DC626D) is 4.16:1 on the card, under AA, so `danger` takes the lighter
// DangerForeground2 and `critical` moves to the orange family to stay 20+ ΔE apart.
//
// `warning` is a metric hue, not an alert: it marks the call rate, which is neither
// destructive (`critical`) nor a failed call (`danger`). ui-check holds it 20+ ΔE from
// `throughput` so the rate figure and its chart series never read as one colour.
//
// `ink-faint` is the third text level — separators, dashes and the dimmest live
// figures — and it is Fluent's NeutralForeground3, which clears AA 4.5 on its own mode's
// card rather than sitting a fixed step below `ink-muted`.
//
// Elevation follows Fluent's own ramp, deepening to the bottom: well < page < card <
// hover. Light starts the well two steps lower than dark does (Background5 vs Background3)
// because the white card leaves no room above it. The separation is carried by the hairline
// pair (`hairline` for surfaces, dividers and button edges; `hairline-strong` only where a
// control needs a boundary that clears 3:1 on its own) plus Fluent's two-layer
// shadows, never by blur.

import { webLightTheme, webDarkTheme } from '@fluentui/react-theme';

export const DEFAULT_MODE = 'dark';

// role -> Fluent token name, per mode. A role whose token differs by mode is a real
// compromise, and the reason is in the row: the floors this file states (AA 4.5 as text
// on the card, ΔE 20 across the pairs that share a word, ΔE 25 across the six chart
// series) cannot all be met from one token name in both directions.
const ROLE_TOKENS = {
  dark: {
    page: 'colorNeutralBackground2',
    sunken: 'colorNeutralBackground3',
    surface: 'colorNeutralBackground1',
    'surface-hover': 'colorNeutralBackground1Hover',
    hairline: 'colorNeutralStroke2',
    // The edge of a control you type into or tick, which has to clear 3:1 against both
    // neighbours on its own (WCAG 1.4.11): the card outside and the well inside it.
    // StrokeAccessible #ADADAD passes at 6.5:1 and reads as a white outline; Stroke1
    // #666666 is only 2.5:1 on the card. Stroke1Hover #757575 is the softest official dark
    // value that clears both sides — 3.2:1 on the card, 4.0:1 on the well. Buttons, panels,
    // bars and menus take `hairline` instead: Fluent draws a surface edge with Stroke2.
    'hairline-strong': 'colorNeutralStroke1Hover',
    ink: 'colorNeutralForeground1',
    'ink-muted': 'colorNeutralForeground2',
    'ink-faint': 'colorNeutralForeground3',
    accent: 'colorBrandBackground',
    'accent-ink': 'colorNeutralForegroundOnBrand',
    'accent-fg': 'colorBrandForeground1',
    success: 'colorStatusSuccessForeground1',
    // DangerForeground1 is 4.16:1 on this mode's card. RedForeground1 is the same
    // warning red, one step lighter, at 5.20.
    danger: 'colorPaletteRedForeground1',
    critical: 'colorPaletteDarkOrangeForeground1',
    warning: 'colorPalettePeachForeground2',
    talk: 'colorPaletteLightTealForeground2',
    throughput: 'colorPaletteMarigoldForeground1',
    'break-time': 'colorPalettePurpleForeground2',
    region: 'colorPaletteLavenderForeground2',
  },
  light: {
    page: 'colorNeutralBackground2',
    // Background3 (#F5F5F5) is 1.09x off the white card: an inset and the surface it is
    // cut into were one colour, and the bar that parks on it vanished. The ramp continues
    // officially (Background4/5/6), so the well takes #EBEBEB.
    sunken: 'colorNeutralBackground5',
    surface: 'colorNeutralBackground1',
    // Background1Hover is #F5F5F5: 3.5 ΔL off the card, so a row wash barely painted,
    // and it was the value the well used before. Background2Hover (#F0F0F0) is the next
    // official step in the same direction, and still sits above the well.
    'surface-hover': 'colorNeutralBackground2Hover',
    hairline: 'colorNeutralStroke2',
    // Stroke1 (#D1D1D1) is only 1.5:1 on white and 5.3 ΔL off Stroke2, so a button edge and
    // a row divider were one colour — which is why `hairline` is Stroke2. For the control
    // edge, Foreground4 (#707070) is the softest official light value that still clears 3:1
    // on both sides of the border: 5.0:1 on the card, 4.2:1 on the well. StrokeAccessible
    // (#616161) is the same requirement one step heavier, and that step is what made a field
    // look outlined in ink.
    'hairline-strong': 'colorNeutralForeground4',
    ink: 'colorNeutralForeground1',
    'ink-muted': 'colorNeutralForeground2',
    'ink-faint': 'colorNeutralForeground3',
    accent: 'colorBrandBackground',
    'accent-ink': 'colorNeutralForegroundOnBrand',
    'accent-fg': 'colorBrandForeground1',
    success: 'colorStatusSuccessForeground1',
    danger: 'colorStatusDangerForeground1',
    // Light has room for a deep crimson that is nowhere near DangerForeground1; dark
    // does not, because its danger is already a pale red.
    critical: 'colorPalettePlumBorderActive',
    warning: 'colorStatusWarningForeground1',
    talk: 'colorPaletteLightTealForeground2',
    throughput: 'colorPaletteGoldForeground2',
    'break-time': 'colorPalettePurpleForeground2',
    region: 'colorPaletteRoyalBlueForeground2',
  },
};

const colorsFor = (theme, tokens) =>
  Object.fromEntries(Object.entries(tokens).map(([role, token]) => [role, theme[token]]));

export const COLOR_MODES = {
  dark: { label: 'Dark', colors: colorsFor(webDarkTheme, ROLE_TOKENS.dark) },
  light: { label: 'Light', colors: colorsFor(webLightTheme, ROLE_TOKENS.light) },
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
