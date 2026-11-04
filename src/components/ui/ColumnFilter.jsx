import React, { useState } from 'react';
import { GlyphColumns as Columns, GlyphGrip as Grip } from './Glyph';
import useDragReorder from '../../hooks/useDragReorder';
import FilterPopover from './FilterPopover';
import { Checkbox } from './ExtensionFilter';

// The handle sits outside the label on purpose: a label forwards every click inside
// itself to its checkbox, so a grip parked in there would toggle the column. Here the
// list runs down, so the column that moves is the whole row and the line drawn across
// the top or bottom edge of a row is the slot the dropped column takes.
function Row({ col, order, setOrder, shownIds, visible, setVisible, lit, setLit }) {
  const { moving, land, handle, target } = useDragReorder({
    id: col.id,
    label: col.label,
    order,
    setOrder,
    shownIds,
    axis: 'y',
    lit,
    setLit
  });
  return (
    <div
      className={`relative flex items-center gap-1 rounded ${moving ? 'bg-k-accent-fg/15' : ''} ${
        land ? 'bg-k-accent-fg/10' : ''
      }`}
      {...target}
    >
      {land && (
        <span
          aria-hidden="true"
          className={`absolute inset-x-0 h-[3px] rounded bg-k-accent-fg ${land === 'after' ? 'bottom-0' : 'top-0'}`}
        />
      )}
      <span
        {...handle}
        className="hoverable grid h-6 w-6 shrink-0 cursor-grab place-items-center rounded text-k-ink-faint active:cursor-grabbing"
      >
        <Grip style={{ fontSize: 14 }} />
      </span>
      <Checkbox
        checked={!!visible[col.id]}
        onChange={() => setVisible({ ...visible, [col.id]: !visible[col.id] })}
      >
        {col.label}
      </Checkbox>
    </div>
  );
}

// Both tables switch columns on and off and both drag them into order, so the menu is
// one component with the option list handed in. It lists in `order`, which is the same
// array the head draws from: a drag in either place moves the other.
export default function ColumnFilter({ options, order, setOrder, visible, setVisible, note }) {
  const [lit, setLit] = useState(null);
  const shown = options.filter((col) => visible[col.id]).length;
  const rows = order.map((id) => options.find((col) => col.id === id)).filter(Boolean);
  // Arrow keys step over the columns the table actually draws, not the hidden rows that
  // happen to sit between them in this list.
  const shownIds = rows.filter((col) => visible[col.id]).map((col) => col.id);

  return (
    <FilterPopover label="Columns" icon={Columns} tone="region" badge={`${shown}/${options.length}`}>
      <div className="space-y-0.5 p-2">
        {rows.map((col) => (
          <Row
            key={col.id}
            col={col}
            order={order}
            setOrder={setOrder}
            shownIds={shownIds}
            visible={visible}
            setVisible={setVisible}
            lit={lit}
            setLit={setLit}
          />
        ))}
        {note && <p className="px-2 pt-1.5 text-2xs text-k-ink-muted">{note}</p>}
      </div>
    </FilterPopover>
  );
}
