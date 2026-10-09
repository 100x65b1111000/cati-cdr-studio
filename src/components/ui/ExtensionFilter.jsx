import React, { useState } from 'react';
import { UserFocus } from '@phosphor-icons/react';
import FilterPopover from './FilterPopover';
import SearchInput from './SearchInput';

const menuItem = 'glow-hover flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-1 text-xs text-k-ink';

export function Checkbox({ checked, onChange, children }) {
  return (
    <label className={`${menuItem} w-full`}>
      <input type="checkbox" checked={checked} onChange={onChange} className="cbox" />
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
    </label>
  );
}

// Both toolbars filter by extension and have to agree on what the badge counts and
// what "None" means, so the popover lives here once rather than per table.
export default function ExtensionFilter({ extensions, names = {}, selected, onChange }) {
  const [query, setQuery] = useState('');
  const q = query.toLowerCase().trim();
  const matches = extensions.filter(
    (ext) => !q || ext.toLowerCase().includes(q) || (names[ext] || '').toLowerCase().includes(q)
  );
  const toggle = (ext) =>
    onChange(selected.includes(ext) ? selected.filter((e) => e !== ext) : [...selected, ext]);

  return (
    <FilterPopover label="Agents" icon={UserFocus} badge={`${selected.length}/${extensions.length}`}>
      <div className="space-y-1.5 p-2">
        <SearchInput value={query} onChange={setQuery} label="Filter agents" placeholder="Filter agents" />
        <div className="flex items-center justify-between border-b border-k-hairline px-2 pb-1.5 text-[11px] text-k-ink-muted">
          <button type="button" className="hover:text-k-accent" onClick={() => onChange([...extensions])}>
            All
          </button>
          <button type="button" className="hover:text-k-danger" onClick={() => onChange([])}>
            None
          </button>
        </div>
        <div className="max-h-56 space-y-0.5 overflow-y-auto pr-1">
          {matches.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-k-ink-muted">No agent matches that.</p>
          ) : (
            matches.map((ext) => (
              <Checkbox key={ext} checked={selected.includes(ext)} onChange={() => toggle(ext)}>
                <span className="num min-w-[3.75rem] shrink-0">{ext}</span>
                {names[ext] && <span className="min-w-0 truncate text-k-ink-muted">{names[ext]}</span>}
              </Checkbox>
            ))
          )}
        </div>
      </div>
    </FilterPopover>
  );
}
