import { COLOR_MODES, cssVarName, hexToRgbTriplet, DEFAULT_MODE } from './src/theme/colorSchemes.js';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,jsx}",
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
      // Basalt's two faces: Space Grotesk for everything written, JetBrains Mono for
      // everything counted. Both come from Google Fonts in app/layout.jsx, and the stacks
      // behind them are the system faces the app used before, so a blocked font request
      // costs a look, not a layout.
      fontFamily: {
        sans: ['"Space Grotesk"', "'Segoe UI'", 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ["'JetBrains Mono'", 'Consolas', 'ui-monospace', 'monospace']
      },
      // 4px is Basalt's --r and the default for every plate and control; 2px is for the
      // small chips, 6-8 for popovers, 12 for the dock, and `full` only for dots, avatars
      // and region pills. The old 3px default was a hand-tuned compromise for the
      // Fira-era density.
      borderRadius: {
        none: '0',
        sm: '2px',
        DEFAULT: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
        full: '9999px'
      }
    },
  },
  plugins: [],
}
