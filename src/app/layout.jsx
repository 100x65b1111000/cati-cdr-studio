import '../index.css';
import { COLOR_MODES, cssVarName, hexToRgbTriplet } from '../theme/colorSchemes';
import '@fontsource/fira-sans/400.css';
import '@fontsource/fira-sans/500.css';
import '@fontsource/fira-sans/600.css';
import '@fontsource/fira-sans/700.css';
import '@fontsource/fira-mono/400.css';
import '@fontsource/fira-mono/500.css';
import '@fontsource/fira-mono/700.css';

export const metadata = {
  title: 'CATI Team CDR Report Studio',
  icons: { icon: '/favicon.svg' }
};

// React applies the palette in a layout effect, which is one paint after the browser
// has already filled the canvas, so a stored light mode flashes dark on every load.
// Resolve the mode here instead; index.css turns `data-mode` into a background with
// no tokens involved. It has to be a classic inline script in the head and it has to
// restate the storage prefix: a deferred script runs after first paint, which is the
// exact problem this exists to solve.
const THEME_SCRIPT = `(function () {
  var mode = 'dark';
  try {
    var saved = JSON.parse(localStorage.getItem('cati_cdr_studio_color_mode'));
    if (saved === 'light' || saved === 'dark') mode = saved;
    else if (!localStorage.getItem('cati_cdr_studio_color_scheme') &&
             matchMedia('(prefers-color-scheme: light)').matches) mode = 'light';
  } catch (e) { /* private mode or a corrupt value: dark is the shipped default */ }
  document.documentElement.dataset.mode = mode;
})();`;

// The --k-* tokens normally arrive from CdrContext's layout effect. A server-rendered
// screen outside the provider — the login page — has no effect to wait for, and
// Tailwind's inline fallbacks in tailwind.config.js are all dark-mode hexes, so a
// light-mode login would paint dark ink on a light canvas. Emit both palettes here from
// the same COLOR_MODES map, keyed on the data-mode the head script sets pre-paint.
// CdrContext's inline writes still win, and the print block wins over both with
// !important, so neither the app's theming path or ui-check's live-document
// assertions change.
const TOKEN_SHEET = Object.entries(COLOR_MODES)
  .map(([id, mode]) =>
    `html[data-mode='${id}']{${Object.entries(mode.colors)
      .map(([role, hex]) => `${cssVarName(role)}:${hexToRgbTriplet(hex)}`)
      .join(';')}}`
  )
  .join('');

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full" data-mode="dark" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: TOKEN_SHEET }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="h-full font-sans antialiased">
        {/* Stands in for the old #root wrapper: full-height flex column. */}
        <div className="flex h-full flex-col">{children}</div>
      </body>
    </html>
  );
}
