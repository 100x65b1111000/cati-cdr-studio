import React from 'react';
import { useCdr } from '../../context/CdrContext';
import { NAV } from './navConfig';

// Below lg there is no rail, so the views live in a bar at the bottom of the screen —
// within thumb reach and never clipped, which is what the old row under the header did
// at 375px. Same NAV list and the same aria-current marker as the sidebar.
export default function MobileNav() {
  const { activeTab, setActiveTab } = useCdr();

  return (
    <nav
      aria-label="Views"
      className="app-bar no-print fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-40 rounded-2xl p-1 lg:hidden"
    >
      <ul className="flex">
        {NAV.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <li key={id} className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setActiveTab(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex w-full flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-2xs font-medium ${
                  active ? 'bg-k-accent/15 text-k-accent' : 'hoverable text-k-ink-muted'
                }`}
              >
                <Icon size={20} weight={active ? 'fill' : 'regular'} />
                <span className="max-w-full truncate">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
