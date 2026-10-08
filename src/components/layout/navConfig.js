import { lazy } from 'react';
import {
  Table,
  ListBullets,
  ChartBar,
  IdentificationCard,
  Sliders
} from '@phosphor-icons/react';
import RundownTable from '../rundown/RundownTable';
import RawCDRTable from '../raw-cdr/RawCDRTable';
import AgentDirectory from '../directory/AgentDirectory';
import SettingsView from '../settings/SettingsView';

// Shared by the sidebar, the narrow-screen header, the print title and App's
// active-view switch, so the view list has exactly one source. `hotkey` feeds
// VIEW_BY_KEY in App.jsx; `component` renders full-size and, scaled down, as
// the hover preview. Analytics stays lazy because it owns the chart bundle.
export const NAV = [
  {
    id: 'rundown',
    label: 'Rundown',
    Icon: Table,
    hotkey: '1',
    desc: 'Per-agent shift table: calls, talk time, break stamps and net active time.',
    component: RundownTable
  },
  {
    id: 'rawCdr',
    label: 'Raw CDR',
    Icon: ListBullets,
    hotkey: '2',
    desc: 'Every parsed call row as it came out of the CSV, searchable and filterable.',
    component: RawCDRTable
  },
  {
    id: 'analytics',
    label: 'Analytics',
    Icon: ChartBar,
    hotkey: '3',
    desc: 'Metric cards, volume per agent-day, region split, talk against break.',
    component: lazy(() => import('../analytics/AnalyticsView'))
  },
  {
    id: 'directory',
    label: 'Agents',
    Icon: IdentificationCard,
    hotkey: '4',
    desc: 'Map extensions to agent names and open an agent detail sheet.',
    component: AgentDirectory
  },
  {
    id: 'settings',
    label: 'Settings',
    Icon: Sliders,
    hotkey: '5',
    desc: 'Colour scheme, shift rules, manual overrides and saved views.',
    component: SettingsView
  }
];
