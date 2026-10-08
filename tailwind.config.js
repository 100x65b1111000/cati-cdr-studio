import { COLOR_SCHEMES, cssVarName, hexToRgbTriplet, DEFAULT_SCHEME } from './src/theme/colorSchemes.js';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // `k-*` utilities resolve to CSS vars applied by the active color scheme
        // (see src/theme/colorSchemes.js). The Kanagawa values act as fallbacks so
        // the page renders correctly before React mounts.
        k: Object.fromEntries(
          Object.entries(COLOR_SCHEMES[DEFAULT_SCHEME].colors).map(([role, hex]) => [
            role,
            `rgb(var(${cssVarName(role)}, ${hexToRgbTriplet(hex)}) / <alpha-value>)`
          ])
        )
      },
      fontFamily: {
        sans: ['Geist Variable', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      // Tighter than the defaults everywhere at once. This is a dense data tool;
      // 12-16px corners on every plate made the tables read as a marketing page.
      // `full` stays for dots, avatars and region pills.
      borderRadius: {
        none: '0',
        sm: '2px',
        DEFAULT: '3px',
        md: '4px',
        lg: '6px',
        xl: '8px',
        '2xl': '10px',
        '3xl': '14px',
        '4xl': '18px',
        full: '9999px'
      }
    },
  },
  plugins: [],
}
