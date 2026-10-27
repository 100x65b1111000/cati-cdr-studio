'use client';

import App from './App';
import { CdrProvider } from './context/CdrContext';

export default function Studio() {
  return (
    <CdrProvider>
      <App />
    </CdrProvider>
  );
}
