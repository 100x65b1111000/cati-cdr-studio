import React from 'react';
import { ColumnTripleRegular as Columns } from '@fluentui/react-icons';
import FilterPopover from './FilterPopover';
import { Checkbox } from './ExtensionFilter';

// Both tables switch columns on and off and both count the badge the same way, so the
// menu is one component with the option list handed in.
export default function ColumnFilter({ options, visible, setVisible, note }) {
  const shown = options.filter((col) => visible[col.id]).length;
  return (
    <FilterPopover label="Columns" icon={Columns} tone="region" badge={`${shown}/${options.length}`}>
      <div className="space-y-0.5 p-2">
        {options.map((col) => (
          <Checkbox
            key={col.id}
            checked={!!visible[col.id]}
            onChange={() => setVisible({ ...visible, [col.id]: !visible[col.id] })}
          >
            {col.label}
          </Checkbox>
        ))}
        {note && <p className="px-2 pt-1.5 text-2xs text-k-ink-muted">{note}</p>}
      </div>
    </FilterPopover>
  );
}
