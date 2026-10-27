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

// Analytics owns the chart bundle, so it is the only code-split view, and the only
// one that can fail to arrive: a 504 while Vite re-optimises deps, or a stale hashed
// chunk after dist is rebuilt under an open tab. React.lazy caches a rejected payload,
// so nothing downstream can retry it. The retry has to live here.
const RELOAD_STAMP = 'cati_cdr_studio_chunk_reload';

function canReload() {
  const last = Number(sessionStorage.getItem(RELOAD_STAMP) || 0);
  if (Date.now() - last < 15000) return false;
  sessionStorage.setItem(RELOAD_STAMP, String(Date.now()));
  return true;
}

function lazyView(importer) {
  return lazy(async () => {
    try {
      return await importer();
    } catch (first) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      try {
        return await importer();
      } catch (second) {
        // Retrying cleared the transient case, so a chunk still missing means the
        // filename is stale. Reloading fetches a fresh index.html with matching
        // hashes. The guard stops a genuinely down server from looping the page.
        if (canReload()) window.location.reload();
        throw second;
      }
    }
  });
}

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
    component: lazyView(() => import('../analytics/AnalyticsView'))
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
    desc: 'Colour mode, shift rules, manual overrides and saved views.',
    component: SettingsView
  }
];
