// Single source of truth for all colour schemes.
// Role keys are kebab-case and map 1:1 to the Tailwind `k` color keys, so a role
// reads the same in JSX (`bg-k-surface-hover`) and as a CSS variable (`--k-surface-hover`).
// The active scheme is applied as `--k-<role>` variables on <html> by CdrContext.
//
// `danger` = a bad call outcome (missed / not answered). `critical` = required-field
// and destructive-action marking. They must never share a hex, or the two meanings
// collapse into one colour.
//
// `ink-faint` sits below `ink-muted` in luminance. It is for separators and
// placeholder dashes, not for secondary text.
//
// `dot` is the backdrop lattice colour. It is normalised by *relative* contrast,
// not by a fixed mix: each value sits at 2.7x the page's luminance, which is what
// the Kanagawa edition's `border` produced against its own background. A single
// alpha cannot do this. Against a page as dark as studio's (#060A12) any shared
// mix reads loudly, while against evergreen's (#2D353B) the same mix is a
// difference of 1.24x and disappears. Weber, not delta.

export const DEFAULT_SCHEME = 'studio';

export const COLOR_SCHEMES = {
  studio: {
    label: 'Studio',
    colors: {
      // Ramp is spaced by perceptual lightness (dL* ~10 per step), not by raw hex
      // distance. WCAG ratios read badly between two dark surfaces and hide the fact
      // that a card has no edge at all.
      page: '#060A12',
      sunken: '#020509',       // below page: inputs and the header strip read recessed
      dot: '#101622',
      surface: '#182234',
      'surface-hover': '#223046',
      hairline: '#2E3E57',
      'hairline-strong': '#46597A',
      ink: '#F4F7FC',
      'ink-muted': '#AFBCD2',
      'ink-faint': '#7A8AA3',
      accent: '#3b82f6',         // blue-500
      // Dark ink on the accent fill: white on blue-500 lands at 3.7:1, below AA.
      'accent-ink': '#060A12',
      success: '#34d399',        // emerald-400
      danger: '#f87171',         // red-400
      critical: '#f43f5e',       // rose-500
      talk: '#22d3ee',           // cyan-400
      throughput: '#fbbf24',     // amber-400
      'break-time': '#a78bfa',   // violet-400
      region: '#818cf8'          // indigo-400
    }
  },
  kanagawa: {
    label: 'Kanagawa',
    colors: {
      page: '#1F1F28',           // SumiInk1
      sunken: '#16161D',         // SumiInk0
      dot: '#363646',            // SumiInk3, the original wave-bg lattice
      surface: '#2A2A37',        // SumiInk3
      'surface-hover': '#363646',
      hairline: '#363646',
      'hairline-strong': '#54546D',
      ink: '#DCD7BA',            // FujiWhite
      'ink-muted': '#9D97B8',
      'ink-faint': '#817B9C',
      accent: '#7E9CD8',         // WaveBlue
      'accent-ink': '#16161D',
      success: '#98BB6C',        // AutumnGreen
      danger: '#E82424',         // PeachRed
      critical: '#FF5D57',       // Efflorescence
      talk: '#7AA89F',           // WaveAqua
      throughput: '#E6C384',     // CarpYellow
      'break-time': '#D27E99',   // SakuraPink
      region: '#76946A'          // SpringGreen
    }
  },
  gruvbox: {
    label: 'Gruvbox',
    colors: {
      page: '#282828',
      sunken: '#1D2021',
      dot: '#48433F',
      surface: '#32302F',
      'surface-hover': '#3C3836',
      hairline: '#504945',
      'hairline-strong': '#665C54',
      ink: '#EBDBB2',
      'ink-muted': '#BDAE93',
      'ink-faint': '#928374',
      accent: '#83A598',
      'accent-ink': '#1D2021',
      success: '#B8BB26',
      danger: '#FB4934',
      critical: '#FE8019',
      talk: '#8EC07C',
      throughput: '#FABD2F',
      'break-time': '#D3869B',
      region: '#A9B665'
    }
  },
  tokyonight: {
    label: 'Tokyo Night',
    colors: {
      page: '#1A1B26',
      sunken: '#16161E',
      dot: '#2D3045',
      surface: '#24283B',
      'surface-hover': '#2F334D',
      hairline: '#2F334D',
      'hairline-strong': '#565F89',
      ink: '#C0CAF5',
      'ink-muted': '#9AA5C8',
      'ink-faint': '#7982A6',
      accent: '#7AA2F7',
      'accent-ink': '#16161E',
      success: '#9ECE6A',
      danger: '#F7768E',
      critical: '#FF9E64',
      talk: '#73DACA',
      throughput: '#E0AF68',
      'break-time': '#BB9AF7',
      region: '#4FD6BE'
    }
  },
  catppuccin: {
    label: 'Catppuccin',
    colors: {
      page: '#1E1E2E',
      sunken: '#181825',
      dot: '#343648',
      surface: '#313244',
      'surface-hover': '#45475A',
      hairline: '#45475A',
      'hairline-strong': '#585B70',
      ink: '#CDD6F4',
      'ink-muted': '#A5ADCB',
      'ink-faint': '#7F849C',
      accent: '#89B4FA',
      'accent-ink': '#11111B',
      success: '#A6E3A1',
      danger: '#F38BA8',
      critical: '#E78284',
      talk: '#94E2D5',
      throughput: '#F9E2AF',
      'break-time': '#F5C2E7',
      region: '#CBA6F7'
    }
  },
  evergreen: {
    label: 'Evergreen',
    colors: {
      page: '#2D353B',
      sunken: '#232A2E',
      dot: '#4F575C',
      surface: '#343F44',
      'surface-hover': '#3D484D',
      hairline: '#475258',
      'hairline-strong': '#5C6569',
      ink: '#D3C6AA',
      'ink-muted': '#A9B5AB',
      'ink-faint': '#828C84',
      accent: '#7FBBB3',
      'accent-ink': '#232A2E',
      success: '#A7C080',
      danger: '#E67E80',
      critical: '#E69875',
      talk: '#83C092',
      throughput: '#DBBC7F',
      'break-time': '#D699B6',
      region: '#9DA9A0'
    }
  }
};

// Chart series resolve through roles, so no scheme needs a second colour list to drift.
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

export function getScheme(id) {
  return COLOR_SCHEMES[id] || COLOR_SCHEMES[DEFAULT_SCHEME];
}

export function getSeries(id) {
  const colors = getScheme(id).colors;
  return SERIES_ROLES.map((role) => colors[role]);
}

// Canvas fills need concrete colour strings, so charts read the variables the
// active scheme already wrote on <html>. The scheme object stays out of the
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
