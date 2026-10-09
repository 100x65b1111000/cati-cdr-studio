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

  const view = NAV.find((n) => n.id === activeTab) || NAV[0];
  const View = view.component;

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
          <h2 className="text-sm font-semibold text-k-ink">{view.label}</h2>
          <p className="num text-[11px] text-k-ink-muted">
            {rangeLabel(dateRange, availableDates(analysis))}
          </p>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 sm:p-6">
          {/* The rail is 48px of icons and the floating bar stays on the brand, so this
              is the only place a view says what it is. It borrows the tiles' icon plate
              and the header's title ink rather than inventing a third heading style. */}
          {/* z-40 because the calendar popover opens from here and the table toolbars
              below are also z-30; equal depth means DOM order, which buries the panel. */}
          <div className="no-print relative z-40 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-k-accent/25 bg-k-accent/10 text-k-accent">
                <view.Icon size={18} />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-bold leading-tight tracking-tight text-k-ink">{view.label}</h2>
                <p className="text-xs leading-tight text-k-ink-muted">{view.desc}</p>
              </div>
              <div className="ml-auto">
                <DateRangeControl />
              </div>
            </div>
            <p className="text-xs text-k-ink-muted">
              <kbd className="num rounded-md border border-k-hairline px-1">1</kbd> to{' '}
              <kbd className="num rounded-md border border-k-hairline px-1">5</kbd> switch views,{' '}
              <kbd className="num rounded-md border border-k-hairline px-1">Ctrl</kbd>+
              <kbd className="num rounded-md border border-k-hairline px-1">K</kbd> searches
            </p>
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
