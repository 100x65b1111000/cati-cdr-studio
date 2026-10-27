// Single source of truth for the two colour modes.
// Role keys are kebab-case and map 1:1 to the Tailwind `k` color keys, so a role
// reads the same in JSX (`bg-k-surface-hover`) and as a CSS variable (`--k-surface-hover`).
// The active mode is applied as `--k-<role>` variables on <html> by CdrContext.
//
// `danger` = a bad call outcome (missed / not answered). `critical` = required-field
// and destructive-action marking. They must never share a hex, or the two meanings
// collapse into one colour.
//
// `warning` is a metric hue, not an alert: it marks the call rate, which is neither
// destructive (`critical`) nor a failed call (`danger`). Both modes paint it a true
// orange, so it never doubles as either red.
//
// `ink-faint` is the third text level — separators, dashes and the dimmest live
// figures. It is tuned to clear AA 4.5 against its own mode's card rather than
// sitting a fixed step below `ink-muted`: two call sites use it for real text, and a
// value that fails there is a failure no comment can talk the browser out of.
//
// Elevation discipline is not symmetric between the modes, and this is deliberate.
// DARK spaces its surfaces by perceptual lightness (dL* ~5 between page, card and
// hover) because there is room at the bottom of the ramp. LIGHT cannot do this:
// #FAFAF8 to #FFFFFF is 1.8 L*, and forcing a 10-point step there means one of the
// two stops is a grey card on a white page. So in light mode the spacing lives in the
// *hairline pair* instead (L* 88.0 and 74.6 — the 10-and-20 steps), which matches how
// the flat surfaces separate plates anyway. Do not "correct" the light ramp back wider.
//
// `accent-ink` is the one role whose *value* is mode-dependent, not just its hue. The
// invariant is that the punch-through on an accent fill clears AA, and the two modes
// need opposite answers: light's accent must also work as 11-12px *text* on white,
// which pins it near L*42, and dark ink on an L*42 fill is 3.1:1. Dark keeps a
// near-black ink, light uses white.
//
// `sunken` sits *below* `page` in both modes: it is the recessed chrome (the app bar,
// fields, the checkbox at rest), not a lighter shade of the surface.

export const DEFAULT_MODE = 'dark';

export const COLOR_MODES = {
  dark: {
    label: 'Dark',
    colors: {
      page: '#0B0E14',
      sunken: '#020306',
      surface: '#161A22',
      'surface-hover': '#1F2632',
      hairline: '#2B3442',
      'hairline-strong': '#3E4A5E',
      ink: '#E8EDF5',
      'ink-muted': '#9AA6BC',
      'ink-faint': '#79879E',
      accent: '#4D8DF5',
      'accent-ink': '#070B12',
      success: '#3FD9A0',
      danger: '#FF7B7B',
      critical: '#E8590C',
      warning: '#FF9E40',
      talk: '#38D6F0',
      throughput: '#F5C247',
      'break-time': '#C491FF',
      region: '#8FA0FF'
    }
  },
  light: {
    label: 'Light',
    colors: {
      page: '#FAFAF8',
      sunken: '#EAEAE2',
      surface: '#FFFFFF',
      'surface-hover': '#F2F2EC',
      hairline: '#DEDDD5',
      'hairline-strong': '#B9B8AC',
      ink: '#1C1C1A',
      'ink-muted': '#5A5A54',
      'ink-faint': '#71716A',
      accent: '#1A56C0',
      'accent-ink': '#FFFFFF',
      success: '#0A6B45',
      danger: '#C1121F',
      critical: '#A2133C',
      warning: '#C2410C',
      talk: '#0E7490',
      throughput: '#8A5A00',
      'break-time': '#6D28D9',
      region: '#3730A3'
    }
  }
};

// Chart series resolve through roles, so neither mode needs a second colour list to drift.
export const SERIES_ROLES = ['accent', 'talk', 'throughput', 'break-time', 'success', 'danger'];

export function cssVarName(role) {
  return '--k-' + role.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}

export function hexToRgbTriplet(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
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
