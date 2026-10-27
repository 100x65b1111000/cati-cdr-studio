import { COLOR_MODES, cssVarName, hexToRgbTriplet, DEFAULT_MODE } from './src/theme/colorSchemes.js';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // `k-*` utilities resolve to CSS vars applied by the active color mode
        // (see src/theme/colorSchemes.js). The default mode's values act as
        // fallbacks so the page renders correctly before React mounts. Tailwind v4
        // applies the `/alpha` modifiers with color-mix() on top of this value, so
        // the var() reference survives re-theming; v3's `<alpha-value>` placeholder
        // is gone.
        k: Object.fromEntries(
          Object.entries(COLOR_MODES[DEFAULT_MODE].colors).map(([role, hex]) => [
            role,
            `rgb(var(${cssVarName(role)}, ${hexToRgbTriplet(hex)}))`
          ])
        )
      },
      fontFamily: {
        sans: ['Fira Sans', 'Segoe UI', 'sans-serif'],
        mono: ['Fira Mono', 'monospace']
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
