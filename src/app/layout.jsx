import '../index.css';
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

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full" data-mode="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="h-full font-sans antialiased">
        {/* Stands in for the old #root wrapper: full-height flex column. */}
        <div className="flex h-full flex-col">{children}</div>
      </body>
    </html>
  );
}
