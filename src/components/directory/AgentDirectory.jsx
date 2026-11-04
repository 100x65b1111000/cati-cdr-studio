import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDownRegular as CaretDown, ChevronUpRegular as CaretUp, DeleteRegular as Trash, PeopleRegular as UsersThree } from '@fluentui/react-icons';
import { useCdr } from '../../context/CdrContext';
import AddAgentModal from './AddAgentModal';
import EmptyState from '../ui/EmptyState';
import SearchInput from '../ui/SearchInput';
import Segmented from '../ui/Segmented';
import Chip from '../ui/Chip';

const numeric = new Intl.Collator(undefined, { numeric: true });

const SORT_OPTIONS = [
  { id: 'extension', label: 'Extension' },
  { id: 'name', label: 'Name' }
];

// A row was two characters of extension and one name against a full page of width.
// Paired cards let the grid spend that width on the names that actually need it.
function AgentCard({ ext, name, onRename, onDelete }) {
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
    <div className="panel lift flex items-center gap-2 rounded px-2 py-1.5">
      <span className="num w-14 flex-none rounded bg-k-accent-fg/15 py-1 text-center text-meta font-medium text-k-accent-fg">
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
        aria-label={`Remove the mapping for ${ext}`}
        className="flex-none rounded p-1.5 text-k-ink-muted transition-colors hover:bg-k-critical/15 hover:text-k-critical"
      >
        <Trash style={{ fontSize: 15 }} />
      </button>
    </div>
  );
}

export default function AgentDirectory() {
  const { extNameMap, updateExtMapping, removeExtMapping, setIsAddAgentOpen, slide } = useCdr();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('extension');
  const [sortAsc, setSortAsc] = useState(true);

  const rows = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = Object.keys(extNameMap).filter((ext) => {
      if (!q) return true;
      return ext.toLowerCase().includes(q) || (extNameMap[ext] || '').toLowerCase().includes(q);
    });
    const dir = sortAsc ? 1 : -1;
    list.sort((a, b) => {
      if (sortField === 'name') return dir * numeric.compare(extNameMap[a] || '', extNameMap[b] || '');
      return dir * numeric.compare(a, b);
    });
    return list;
  }, [extNameMap, search, sortField, sortAsc]);

  const mapped = Object.keys(extNameMap).length;

  return (
    <div className={`animate__animated ${slide} panel overflow-hidden rounded-md`}>
      <div className="no-print flex flex-wrap items-center gap-2 border-b border-k-hairline bg-k-surface/50 px-4 py-3">
        <h3 className="mr-1 flex items-center gap-2 text-xs font-semibold text-k-ink">
          <UsersThree style={{ fontSize: 16 }} className="text-k-talk" />
          Extension mapping
          <Chip tone="talk">{mapped}</Chip>
        </h3>
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
              onRename={updateExtMapping}
              onDelete={removeExtMapping}
            />
          ))}
        </div>
      )}

      <AddAgentModal />
    </div>
  );
}
