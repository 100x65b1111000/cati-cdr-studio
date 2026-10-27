'use client';

import dynamic from 'next/dynamic';

// ssr: false, not because the app needs it but because the app cannot do otherwise:
// nine loadFromStorage calls and a window.matchMedia read fire in useState/useRef
// initialisers across CdrContext, RundownTable and RawCDRTable. Server-rendering this
// tree would resolve every one of them to its default, then the browser's first render
// would resolve them to the stored value and mismatch the whole page. This is a local
// data tool behind a password with nothing to index, so the client-only mount is also
// exactly what Vite did, which keeps the port behaviour-neutral.
// The no-flash guarantee survives it: layout.jsx paints data-mode in the <head>.
const Studio = dynamic(() => import('../Studio'), { ssr: false });

export default function Page() {
  return <Studio />;
}
