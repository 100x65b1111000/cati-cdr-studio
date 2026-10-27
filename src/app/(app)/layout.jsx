'use client';

import dynamic from 'next/dynamic';

// One client boundary for the whole signed-in app. `ssr: false` because nine
// localStorage reads and a window.matchMedia live in useState initialisers across
// CdrContext, RundownTable and RawCDRTable, and the page it renders here never executes
// on the server: the Studio below does not mount until the browser takes over.
// Keeping the boundary in the layout instead of the page is what lets every route share
// one CdrProvider, so the sidebar, the header and the view all read the same state.
const Studio = dynamic(() => import('../../Studio'), { ssr: false });

export default function AppLayout({ children }) {
  return <Studio>{children}</Studio>;
}
