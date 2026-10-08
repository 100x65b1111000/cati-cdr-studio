import React, { Suspense, useEffect } from 'react';
import { useCdr } from './context/CdrContext';
import AppHeader from './components/layout/AppHeader';
import AppSidebar from './components/layout/AppSidebar';
import { NAV } from './components/layout/navConfig';
import DateRangeControl from './components/layout/DateRangeControl';
import ToastContainer from './components/common/ToastContainer';
import { availableDates, rangeLabel } from './utils/dateRange';
import ErrorBanner from './components/ui/ErrorBanner';
import ShiftSettingsModal from './components/modals/ShiftSettingsModal';
import AgentDetailModal from './components/modals/AgentDetailModal';
import CdrPreviewModal from './components/modals/CdrPreviewModal';
import DropzoneOverlay from './components/modals/DropzoneOverlay';

const VIEW_BY_KEY = Object.fromEntries(NAV.map((n) => [n.hotkey, n.id]));

export default function App() {
  const { activeTab, setActiveTab, parseError, clearParseError, analysis, dateRange } = useCdr();

  useEffect(() => {
    function onKeydown(e) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        document.querySelector('main [data-search-primary]')?.focus();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const view = VIEW_BY_KEY[e.key];
      if (view) setActiveTab(view);
    }
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [setActiveTab]);

  const View = NAV.find((n) => n.id === activeTab)?.component;

  return (
    <div className="dot-bg relative flex min-h-[100dvh] flex-col bg-k-page text-k-ink antialiased selection:bg-k-accent selection:text-k-accent-ink">
      <div aria-hidden="true" className="blob animate-pulse-slow left-1/4 top-0 bg-k-accent/35" />
      <div
        aria-hidden="true"
        className="blob animate-pulse-slow bottom-10 right-1/4 bg-k-region/30"
        style={{ animationDelay: '2s' }}
      />
      <div
        aria-hidden="true"
        className="blob animate-pulse-slow left-0 top-1/2 bg-k-talk/25"
        style={{ animationDelay: '1s' }}
      />

      <AppHeader />
      <AppSidebar />

      <div className="relative flex min-w-0 flex-1 flex-col lg:pl-20">
        <header className="hidden print:block print:pb-2">
          <h2 className="text-sm font-semibold text-k-ink">
            {NAV.find((n) => n.id === activeTab)?.label || 'CATI CDR Studio'}
          </h2>
          <p className="num text-[11px] text-k-ink-muted">
            {rangeLabel(dateRange, availableDates(analysis))}
          </p>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 sm:p-6">
          <div className="no-print flex flex-wrap items-center gap-3">
            <p className="text-xs text-k-ink-muted">
              <kbd className="num rounded-md border border-k-hairline px-1">1</kbd> to{' '}
              <kbd className="num rounded-md border border-k-hairline px-1">5</kbd> switch views,{' '}
              <kbd className="num rounded-md border border-k-hairline px-1">Ctrl</kbd>+
              <kbd className="num rounded-md border border-k-hairline px-1">K</kbd> searches
            </p>
            <div className="ml-auto">
              <DateRangeControl />
            </div>
          </div>

          {parseError && <ErrorBanner message={parseError} onDismiss={clearParseError} />}

          {View && (
            <Suspense fallback={<div className="py-16 text-center text-xs text-k-ink-muted">Loading view</div>}>
              <View />
            </Suspense>
          )}
        </main>
      </div>

      <ShiftSettingsModal />
      <AgentDetailModal />
      <CdrPreviewModal />
      <DropzoneOverlay />
      <ToastContainer />
    </div>
  );
}
