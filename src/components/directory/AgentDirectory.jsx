import React, { useEffect, useMemo, useState } from 'react';
import { GlyphCaretDown as CaretDown, GlyphCaretUp as CaretUp, GlyphTrash as Trash, GlyphEye as Eye } from '../ui/Glyph';
import { useCdr } from '../../context/CdrContext';
import AddAgentModal from './AddAgentModal';
import EmptyState from '../ui/EmptyState';
import SearchInput from '../ui/SearchInput';
import Segmented from '../ui/Segmented';
import { inDateRange, rangeDates } from '../../utils/dateRange';

const numeric = new Intl.Collator(undefined, { numeric: true });

const SORT_OPTIONS = [
  { id: 'extension', label: 'Extension' },
  { id: 'name', label: 'Name' },
  { id: 'calls', label: 'Calls' }
];

// A row was two characters of extension and one name against a full page of width.
// Paired cards let the grid spend that width on the names that actually need it. The
// extension sits in a `sunken` plate rather than a cyan wash: it is a key, and the one
// electric hue in Basalt is reserved for what a reader can act on. The card now carries
// what the agent did in the range, because a mapping list with no evidence of work is a
// config page, and this is the page you go to to find the person.
function AgentCard({ ext, name, stats, onRename, onDelete, onReport }) {
  const [draft, setDraft] = useState(name);

  useEffect(() => {
    setDraft(name);
  }, [name]);

  const dirty = draft !== name;

  const commit = () => {
    if (!dirty) return;
    onRename(ext, draft);
  };

  return (
    <div className="panel lift flex flex-col gap-2 rounded p-2">
      <div className="flex items-center gap-2">
        <span className="num w-12 flex-none rounded bg-k-sunken py-1 text-center text-meta font-semibold text-k-accent-fg">
          {ext}
        </span>
        <input
          type="text"
          value={draft}
          aria-label={`Name for extension ${ext}`}
          placeholder={`Agent ${ext}`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setDraft(name);
          }}
          className={`field min-w-0 flex-1 rounded px-2.5 py-1.5 text-xs text-k-ink placeholder:text-k-ink-muted focus:border-k-accent-fg focus:outline-none ${
            dirty ? 'border-k-accent-fg' : 'hover:border-k-accent-fg/50'
          }`}
        />
        <button
          type="button"
          onClick={() => onDelete(ext)}
          title={name ? `Clear name for extension ${ext}` : `Remove extension ${ext}`}
          aria-label={name ? `Clear name for extension ${ext}` : `Remove extension ${ext}`}
          className="flex-none rounded p-1.5 text-k-ink-muted transition-colors hover:bg-k-critical/15 hover:text-k-critical"
        >
          <Trash style={{ fontSize: 15 }} />
        </button>
      </div>

      {stats ? (
        <>
          <div className="flex items-baseline justify-between gap-2 text-2xs text-k-ink-muted">
            <span className="num text-k-ink">{stats.calls} calls</span>
            <span className="num">{stats.rate}% connected</span>
            <button
              type="button"
              onClick={() => onReport(ext, stats.last)}
              aria-label={`Breakdown for ${ext} on ${stats.last}`}
              className="hoverable inline-flex items-center gap-1 rounded border border-k-hairline px-1.5 py-0.5 text-2xs text-k-ink-muted"
            >
              <Eye style={{ fontSize: 12 }} />
              Report
            </button>
          </div>
          <div className="h-1 overflow-hidden rounded bg-k-sunken ring-1 ring-inset ring-k-hairline">
            <div className="h-full rounded bg-k-talk" style={{ width: `${stats.rate}%` }} />
          </div>
        </>
      ) : (
        <p className="text-2xs text-k-ink-faint">No calls in this date range.</p>
      )}
    </div>
  );
}

export default function AgentDirectory() {
  const { extNameMap, analysis, dateRange, updateExtMapping, removeExtMapping, resetExtMappings, setIsAddAgentOpen, setSelectedAgentDetail, slide } =
    useCdr();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('extension');
  const [sortAsc, setSortAsc] = useState(true);

  // Scoped to the same date range the rundown and analytics honour, so the card is not
  // quietly counting a month while the page above it says "last 7 days".
  const stats = useMemo(() => {
    const dateSet = new Set(rangeDates(dateRange, analysis));
    const out = {};
    Object.entries(analysis).forEach(([ext, byDate]) => {
      let calls = 0;
      let connected = 0;
      let last = '';
      Object.entries(byDate).forEach(([date, row]) => {
        if (!inDateRange(date, dateRange, dateSet)) return;
        calls += row.total_calls;
        connected += row.connected_calls;
        if (date > last) last = date;
      });
      if (calls) out[ext] = { calls, rate: Math.round((connected / calls) * 100), last };
    });
    return out;
  }, [analysis, dateRange]);

  const rows = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = Object.keys(extNameMap).filter((ext) => {
      if (!q) return true;
      return ext.toLowerCase().includes(q) || (extNameMap[ext] || '').toLowerCase().includes(q);
    });
    const dir = sortAsc ? 1 : -1;
    list.sort((a, b) => {
      if (sortField === 'name') return dir * numeric.compare(extNameMap[a] || '', extNameMap[b] || '');
      if (sortField === 'calls') return dir * ((stats[a]?.calls || 0) - (stats[b]?.calls || 0));
      return dir * numeric.compare(a, b);
    });
    return list;
  }, [extNameMap, search, sortField, sortAsc, stats]);

  const mapped = Object.keys(extNameMap).length;
  const busy = rows.reduce((sum, ext) => sum + (stats[ext]?.calls || 0), 0);

  return (
    <div className={`animate__animated ${slide} panel overflow-hidden rounded`}>
      {/* The count is the fact this page is about, so the title reads the way the rundown
          KPI strip reads — a label in ink-muted and the figure in mono on one baseline,
          no icon and no restated hex. The strip stays on `surface`, not `sunken`: the
          search field is sunken, and a sunken field on a sunken plate has no edge left. */}
      <div className="no-print flex flex-wrap items-center gap-2 border-b border-k-hairline px-3.5 py-2.5">
        <p className="mr-1 flex items-baseline gap-1.5 text-2xs leading-tight text-k-ink-muted">
          Extensions mapped
          <span className="num text-md font-semibold text-k-accent-fg">{mapped}</span>
        </p>
        <p className="mr-1 flex items-baseline gap-1.5 text-2xs leading-tight text-k-ink-muted">
          Calls in range
          <span className="num text-md font-semibold text-k-accent-fg">{busy}</span>
        </p>
        <SearchInput
          value={search}
          onChange={setSearch}
          label="Extension or name"
          placeholder="Extension or name"
          className="w-full flex-none sm:w-56"
        />
        <div className="flex w-full items-center justify-end gap-1.5 sm:ml-auto sm:w-auto">
          <Segmented
            label="Sort mappings by"
            options={SORT_OPTIONS}
            value={sortField}
            onChange={(field) => {
              setSortField(field);
              setSortAsc(true);
            }}
          />
          <button
            type="button"
            onClick={() => setSortAsc((v) => !v)}
            aria-label={sortAsc ? 'Sort descending' : 'Sort ascending'}
            className="hoverable flex h-[30px] w-[30px] flex-none items-center justify-center rounded border border-k-hairline text-k-ink-muted"
          >
            {sortAsc ? <CaretUp style={{ fontSize: 14 }} /> : <CaretDown style={{ fontSize: 14 }} />}
          </button>
          <button
            type="button"
            onClick={resetExtMappings}
            aria-label="Reset agent mappings to default"
            className="hoverable inline-flex h-[30px] items-center rounded border border-k-hairline px-2.5 text-xs text-k-ink-muted transition-colors hover:border-k-hairline-strong hover:text-k-ink"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => setIsAddAgentOpen(true)}
            className="inline-flex h-[30px] items-center rounded bg-k-accent px-3.5 text-xs font-medium text-k-accent-ink transition-colors hover:bg-k-accent/90 active:translate-y-[1px]"
          >
            Add mapping
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={mapped === 0 ? 'No extensions mapped yet' : 'No agent matches that'}
          body={
            mapped === 0
              ? 'Maps are optional. Unmapped extensions show as their number in the rundown.'
              : 'Try a shorter search, or clear it to see every mapping.'
          }
          action={
            mapped === 0 ? (
              <button
                type="button"
                onClick={() => setIsAddAgentOpen(true)}
                className="rounded bg-k-accent px-3.5 py-2 text-xs font-medium text-k-accent-ink transition-colors hover:bg-k-accent/90 active:translate-y-[1px]"
              >
                Add a mapping
              </button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {rows.map((ext) => (
            <AgentCard
              key={ext}
              ext={ext}
              name={extNameMap[ext] || ''}
              stats={stats[ext]}
              onRename={updateExtMapping}
              onDelete={removeExtMapping}
              onReport={(target, date) => setSelectedAgentDetail({ ext: target, dateStr: date })}
            />
          ))}
        </div>
      )}

      <AddAgentModal />
    </div>
  );
}
