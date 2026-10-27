'use client';

import App from './App';
import { CdrProvider } from './context/CdrContext';

// The route's view element arrives as children and renders inside the provider, so the
// sidebar, the header and the view all read one CdrContext.
export default function Studio({ children }) {
  return (
    <CdrProvider>
      <App>{children}</App>
    </CdrProvider>
  );
}
