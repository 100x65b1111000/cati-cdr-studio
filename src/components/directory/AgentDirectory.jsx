import React, { useEffect, useMemo, useState } from 'react';
import { UsersThree, Trash } from '@phosphor-icons/react';
import { useCdr } from '../../context/CdrContext';
import AddAgentModal from './AddAgentModal';
import EmptyState from '../ui/EmptyState';
import SearchInput from '../ui/SearchInput';
import SortHeaderCell from '../ui/SortHeaderCell';

const numeric = new Intl.Collator(undefined, { numeric: true });

function AgentRow({ ext, name, onRename, onDelete }) {
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
    <tr className="h-[38px] transition-colors hover:bg-k-surface-hover/40">
      <td className="num w-1 whitespace-nowrap px-3 font-semibold text-k-accent">{ext}</td>
      <td className="w-full px-3">
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
          className={`glass-input w-full max-w-xs rounded-lg px-2.5 py-1.5 text-xs text-k-ink placeholder:text-k-ink-muted ${
            dirty ? 'border-k-accent' : 'hover:border-k-accent/50'
          }`}
        />
      </td>
      <td className="px-3 text-right whitespace-nowrap">
        <button
          type="button"
          onClick={() => onDelete(ext)}
          aria-label={`Remove the mapping for ${ext}`}
          title="Remove this mapping"
          className="rounded-lg p-1.5 text-k-ink-muted transition-colors hover:bg-k-danger/10 hover:text-k-critical"
        >
          <Trash size={14} />
        </button>
      </td>
    </tr>
  );
}

export default function AgentDirectory() {
  const { extNameMap, updateExtMapping, removeExtMapping, setIsAddAgentOpen } = useCdr();
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

  const handleSort = (field) => {
    if (field === sortField) {
      setSortAsc((v) => !v);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const mapped = Object.keys(extNameMap).length;

  return (
    <div className="panel overflow-hidden rounded-xl">
      <div className="no-print flex flex-wrap items-center gap-2 border-b border-k-hairline bg-k-surface/50 px-4 py-3">
        <h3 className="mr-1 flex items-center gap-2 text-xs font-semibold text-k-ink">
          <UsersThree size={16} className="text-k-talk" />
          Extension mapping
          <span className="num rounded-full bg-k-talk/10 px-2.5 py-0.5 text-[10px] font-normal text-k-talk">
            {mapped}
          </span>
        </h3>
        <SearchInput
          value={search}
          onChange={setSearch}
          label="Extension or name"
          placeholder="Extension or name"
          className="w-56 flex-none"
        />
        <button
          type="button"
          onClick={() => setIsAddAgentOpen(true)}
          className="glow-accent ml-auto rounded-lg bg-k-accent px-3.5 py-2 text-xs font-medium text-k-accent-ink transition-colors hover:bg-k-accent/90 active:translate-y-[1px]"
        >
          Add mapping
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-k-ink-muted">
          <thead className="sticky top-0 z-[25] border-b border-k-hairline glass-head text-[10px] uppercase tracking-wider">
            <tr>
              <SortHeaderCell
                label="Extension"
                field="extension"
                sortField={sortField}
                sortAsc={sortAsc}
                onSort={handleSort}
                className="w-1"
              />
              <SortHeaderCell
                label="Agent name"
                field="name"
                sortField={sortField}
                sortAsc={sortAsc}
                onSort={handleSort}
                className="w-full"
              />
              <th scope="col" className="w-16 px-3 py-3.5 text-right text-[10px] font-semibold uppercase tracking-wider text-k-ink-muted">
                Remove
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-k-hairline/60">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3}>
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
                          className="rounded-lg bg-k-accent px-3.5 py-2 text-xs font-medium text-k-accent-ink transition-colors hover:bg-k-accent/90 active:translate-y-[1px]"
                        >
                          Add a mapping
                        </button>
                      ) : null
                    }
                  />
                </td>
              </tr>
            ) : (
              rows.map((ext) => (
                <AgentRow
                  key={ext}
                  ext={ext}
                  name={extNameMap[ext] || ''}
                  onRename={updateExtMapping}
                  onDelete={removeExtMapping}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddAgentModal />
    </div>
  );
}
