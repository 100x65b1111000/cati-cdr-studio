import { lazy } from 'react';
import { GlyphAgents, GlyphConfig, GlyphRaw, GlyphRundown, GlyphStats } from '../ui/Glyph';

// Shared by the sidebar, the narrow-screen header, the print title and the route in
// app/(app)/[view]/page.jsx, so the view list has exactly one source. `id` is
// also the URL segment, and `hotkey` feeds VIEW_BY_KEY in App.jsx.
//
// Every view is lazy: the route gives it a URL and React.lazy gives it a chunk. A chunk
// that fails to arrive is retried by the router on the next navigation, so nothing here
// has to stash a reload stamp to recover from a stale build.
export const NAV = [
  {
    id: 'rundown',
    label: 'Rundown',
    Icon: GlyphRundown,
    hotkey: '1',
    desc: 'Per-agent shift table: calls, talk time, break stamps and net active time.',
    component: lazy(() => import('../rundown/RundownTable'))
  },
  {
    id: 'rawCdr',
    label: 'Raw CDR',
    Icon: GlyphRaw,
    hotkey: '2',
    desc: 'Every parsed call row as it came out of the CSV, searchable and filterable.',
    component: lazy(() => import('../raw-cdr/RawCDRTable'))
  },
  {
    id: 'analytics',
    label: 'Analytics',
    Icon: GlyphStats,
    hotkey: '3',
    desc: 'Volume per agent-day, the hour line, region split, shift by shift.',
    component: lazy(() => import('../analytics/AnalyticsView'))
  },
  {
    id: 'directory',
    label: 'Agents',
    Icon: GlyphAgents,
    hotkey: '4',
    desc: 'Map extensions to agent names and open an agent detail sheet.',
    component: lazy(() => import('../directory/AgentDirectory'))
  },
  {
    id: 'settings',
    label: 'Settings',
    Icon: GlyphConfig,
    hotkey: '5',
    desc: 'Shift rules and what they produce, manual overrides, and this browser session.',
    component: lazy(() => import('../settings/SettingsView'))
  }
];
