import React, { Suspense, useEffect, useRef } from 'react';
import { useCdr } from './context/CdrContext';
import AppHeader from './components/layout/AppHeader';
import AppSidebar from './components/layout/AppSidebar';
import { NAV } from './components/layout/navConfig';
import DateRangeControl from './components/layout/DateRangeControl';
import ToastContainer from './components/common/ToastContainer';
import { availableDates, rangeLabel } from './utils/dateRange';
import ErrorBanner from './components/ui/ErrorBanner';
import ViewErrorBoundary from './components/ui/ViewErrorBoundary';
import ShiftSettingsModal from './components/modals/ShiftSettingsModal';
import AgentDetailModal from './components/modals/AgentDetailModal';
import CdrPreviewModal from './components/modals/CdrPreviewModal';
import DropzoneOverlay from './components/modals/DropzoneOverlay';

const VIEW_BY_KEY = Object.fromEntries(NAV.map((n) => [n.hotkey, n.id]));

function focusSearch() {
  const el = document.querySelector('main [data-search-primary]');
  if (!el) return false;
  el.focus();
  return true;
}

export default function App({ children }) {
  const { activeTab, setActiveTab, parseError, clearParseError, analysis, dateRange } = useCdr();

  const wantsSearchRef = useRef(false);

  useEffect(() => {
    function onKeydown(e) {
      // A dialog owns the keyboard while it is up: Modal traps Tab and marks itself
      // aria-modal, but nothing stops a bare digit from swapping the view underneath it.
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (focusSearch()) return;
        // Analytics and Settings have no search field, so the documented shortcut
        // would swallow the keystroke. Land on the view that does have one instead.
        setActiveTab('rundown');
        wantsSearchRef.current = true;
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

  useEffect(() => {
    if (wantsSearchRef.current && focusSearch()) wantsSearchRef.current = false;
  }, [activeTab]);

  const view = NAV.find((n) => n.id === activeTab) || NAV[0];

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-k-page text-k-ink antialiased selection:bg-k-accent selection:text-k-accent-ink">
      {/* First tab stop, off-screen until it has focus. Without it a keyboard user
          works through the whole header and rail before reaching the table. The ring
          is the page ink, not the accent: the base :focus-visible outline would be
          accent-on-accent. */}
      <a
        href="#view"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-k-accent focus:px-3.5 focus:py-2 focus:text-xs focus:font-medium focus:text-k-accent-ink focus:outline-2 focus:outline-k-ink focus:outline-offset-2"
      >
        Skip to content
      </a>

      <AppHeader />
      <AppSidebar />

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col lg:pl-[19.5rem]">
        <header className="hidden print:block print:pb-2">
          <h2 className="text-sm font-semibold text-k-ink">{view.label}</h2>
          <p className="num text-meta text-k-ink-muted">
            {rangeLabel(dateRange, availableDates(analysis))}
          </p>
        </header>

        {/* A column, and `min-h-0` so it stops refusing to shrink below its own content:
            the report region below takes whatever height this leaves rather than guessing
            at the chrome stacked above it. */}
        <main
          id="view"
          tabIndex={-1}
          className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col space-y-6 p-4 sm:p-6"
        >
          {/* The rail is 48px of icons and the floating bar stays on the brand, so this
              is the only place a view says what it is. It borrows the tiles' icon plate
              and the header's title ink rather than inventing a third heading style. */}
          {/* z-[35]: above the z-30 table toolbars, or the calendar popover this row
              opens would lose to them on DOM order, but below the z-40 chrome, or this
              whole heading scrolls up and paints on top of the floating app bar. */}
          <div className="no-print relative z-[35] space-y-2">
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

          {children && (
            <ViewErrorBoundary resetKey={activeTab}>
              <Suspense fallback={<div className="py-16 text-center text-xs text-k-ink-muted">Loading view</div>}>
                {children}
              </Suspense>
            </ViewErrorBoundary>
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
