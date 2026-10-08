import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useCdr } from '../../context/CdrContext';
import { NAV } from './navConfig';
import { availableDates } from '../../utils/dateRange';
import { COLUMNS } from '../rundown/columns';
import { COLOR_SCHEMES } from '../../theme/colorSchemes';

const CHIPS = {
  rundown: (s) => [[s.agents, 'agents'], [s.calls, 'calls'], [s.columns, 'columns']],
  rawCdr: (s) => [[s.calls, 'rows'], [s.fields, 'fields']],
  analytics: (s) => [[s.agentDays, 'agent-days'], [s.dates, 'dates']],
  directory: (s) => [[s.agents, 'extensions'], [s.overrides, 'overrides']],
  settings: (s) => [[s.schemes, 'schemes'], [s.views, 'views']]
};

// The real view, mounted, cropped to its top-left and scaled into the card.
// 820x420 of layout at 0.32 keeps the type just legible enough to read as
// *this* section instead of a generic page.
const THUMB = { w: 820, h: 420, scale: 0.32 };

function Thumb({ item }) {
  const View = item.component;
  return (
    <div
      data-thumb
      className="dot-bg overflow-hidden rounded-lg border border-k-hairline bg-k-page"
      style={{ width: THUMB.w * THUMB.scale, height: THUMB.h * THUMB.scale }}
    >
      <div style={{ width: THUMB.w, transform: `scale(${THUMB.scale})`, transformOrigin: 'top left' }}>
        <Suspense fallback={null}>
          <View preview />
        </Suspense>
      </div>
    </div>
  );
}

function useStats() {
  const { rawCalls, rawRecords, analysis, extNameMap, manualOverrides, savedViews } = useCdr();
  return useMemo(() => {
    const agentDays = Object.values(analysis).reduce((n, byDate) => n + Object.keys(byDate).length, 0);
    return {
      agents: Object.keys(extNameMap).length,
      calls: rawCalls.length,
      columns: COLUMNS.length,
      fields: rawRecords[0] ? Object.keys(rawRecords[0]).length : 0,
      agentDays,
      dates: availableDates(analysis).length,
      overrides: Object.keys(manualOverrides).length,
      views: savedViews.length,
      schemes: Object.keys(COLOR_SCHEMES).length
    };
  }, [rawCalls, rawRecords, analysis, extNameMap, manualOverrides, savedViews]);
}

function Preview({ item, stats, top }) {
  const Icon = item.Icon;
  return (
    <div
      aria-hidden="true"
      style={{ top }}
      className="glass-menu animate-pop-down pointer-events-none absolute left-full z-10 ml-3 w-72 rounded-xl p-3"
    >
      <div className="flex items-center gap-1.5">
        <Icon size={14} className="text-k-accent" />
        <span className="text-xs font-semibold text-k-ink">{item.label}</span>
      </div>
      <div className="mt-2">
        <Thumb item={item} />
      </div>
      <p className="mt-2 text-[11px] leading-snug text-k-ink-muted">{item.desc}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {CHIPS[item.id](stats).map(([n, l]) => (
          <span
            key={l}
            className="num rounded-md bg-k-sunken/70 px-1.5 py-0.5 text-[10px] text-k-ink-muted ring-1 ring-inset ring-k-hairline"
          >
            <span className="font-semibold text-k-ink">{n}</span> {l}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AppSidebar() {
  const { activeTab, setActiveTab } = useCdr();
  const stats = useStats();
  const [peek, setPeek] = useState(null);
  const timer = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  // A short open delay keeps the panel from strobing while the pointer travels
  // down the list. Close is immediate so it never lags behind the cursor.
  // The offset is measured against the aside because the preview is its child,
  // not the nav's: the nav has to clip, and clipping would take the card with it.
  const show = (id, el) => {
    const top = el.getBoundingClientRect().top - el.closest('aside').getBoundingClientRect().top;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPeek({ id, top }), 120);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setPeek(null);
  };

  const peeked = peek && NAV.find((n) => n.id === peek.id);

  return (
    // Detached rail: 48px of icons until the pointer claims it, then it expands
    // over the content rather than shoving the content aside. The preview is a
    // sibling of the nav because the nav has to clip its own labels.
    <aside className="no-print fixed left-4 top-1/2 z-40 hidden -translate-y-1/2 lg:block">
      <nav
        aria-label="Views"
        className="group/rail panel relative w-12 overflow-hidden rounded-2xl shadow-2xl shadow-black/40 transition-[width] duration-200 ease-out hover:w-60"
      >
        <ul className="space-y-1 p-1.5">
          {NAV.map((item) => {
            const active = activeTab === item.id;
            return (
              <li
                key={item.id}
                onMouseEnter={(e) => show(item.id, e.currentTarget)}
                onMouseLeave={hide}
                onFocus={(e) => show(item.id, e.currentTarget)}
                onBlur={hide}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-xs font-medium transition-colors ${
                    active
                      ? 'glow-accent bg-k-accent text-k-accent-ink'
                      : 'text-k-ink-muted hover:bg-k-surface-hover hover:text-k-ink'
                  }`}
                >
                  <item.Icon size={17} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-left opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100">
                    {item.label}
                  </span>
                  <kbd
                    className={`num shrink-0 rounded-[4px] border px-1 text-[10px] ${
                      active ? 'border-k-accent-ink/40 text-k-accent-ink' : 'border-k-hairline text-k-ink-muted'
                    }`}
                  >
                    {item.hotkey}
                  </kbd>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      {peeked && <Preview item={peeked} stats={stats} top={peek.top} />}
    </aside>
  );
}
