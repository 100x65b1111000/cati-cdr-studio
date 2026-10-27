import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { CdrProvider } from './context/CdrContext';
import '@fontsource/fira-sans/400.css';
import '@fontsource/fira-sans/500.css';
import '@fontsource/fira-sans/600.css';
import '@fontsource/fira-sans/700.css';
import '@fontsource/fira-mono/400.css';
import '@fontsource/fira-mono/500.css';
import '@fontsource/fira-mono/700.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CdrProvider>
      <App />
    </CdrProvider>
  </React.StrictMode>
);
