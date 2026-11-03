import React, { useState } from 'react';
import {
  ChevronDownRegular as CaretDown,
  ChevronUpRegular as CaretUp,
  ReOrderDotsVerticalRegular as Grip
} from '@fluentui/react-icons';
import { moveById, nudgeById } from '../../utils/columnOrder';

export default function SortHeaderCell({
  label,
  field,
  sortField,
  sortAsc,
  onSort,
  align = 'left',
  className = '',
  sortable = true,
  reorder
}) {
  const [over, setOver] = useState(false);
  const active = sortable && sortField === field;
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  // The handle is the drag source, the whole cell is the landing pad: you drop a column
  // onto the header it should take. A `draggable` <button> never starts a drag in
  // Firefox, so the handle is a span that answers the keyboard itself.
  const handle = reorder && (
    <span
      role="button"
      tabIndex={0}
      aria-label={`Reorder ${label} column. Arrow keys move it.`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', field);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setDragImage(e.currentTarget.closest('th'), 8, 8);
      }}
      onDragEnd={() => setOver(false)}
      onKeyDown={(e) => {
        // Plain arrows, once the handle has focus: Alt+Left is the browser's own Back,
        // and a reorder shortcut that leaves the app is worse than none.
        const delta = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
        if (!delta) return;
        e.preventDefault();
        reorder.setOrder(nudgeById(reorder.order, field, delta));
      }}
      className="hoverable grid h-6 w-6 shrink-0 cursor-grab place-items-center rounded text-k-ink-faint active:cursor-grabbing print:hidden"
    >
      <Grip style={{ fontSize: 14 }} />
    </span>
  );

  const title = sortable ? (
    /* The cell's padding lives on the button, not on the th, so the whole header
       cell is the sort target rather than a two-word glyph floating in the middle
       of it. Same pixels, same height, 32x16 becomes a full-cell hit area. With a
       handle, its 24px box is the left inset instead of the padding on top of it. */
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`inline-flex items-center gap-1 whitespace-nowrap ${reorder ? 'pr-3' : 'px-3'} py-3.5 transition-colors ${
        active ? 'text-k-accent-fg' : 'text-k-ink-muted hover:text-k-ink'
      }`}
    >
      {label}
      {active &&
        (sortAsc ? <CaretUp style={{ fontSize: 12 }} /> : <CaretDown style={{ fontSize: 12 }} />)}
    </button>
  ) : (
    <span className={`inline-flex items-center whitespace-nowrap ${reorder ? 'pr-3' : 'px-3'} py-3.5 text-k-ink-muted`}>
      {label}
    </span>
  );

  return (
    <th
      scope="col"
      aria-label={label}
      aria-sort={sortable ? (active ? (sortAsc ? 'ascending' : 'descending') : 'none') : undefined}
      className={`${alignClass} ${className} ${over ? 'bg-k-accent-fg/10' : ''}`}
      {...(reorder
        ? {
            onDragOver: (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (!over) setOver(true);
            },
            // Entering a child of the same cell bubbles a dragleave out of it; only
            // leaving for good may clear the marker.
            onDragLeave: (e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setOver(false);
            },
            onDrop: (e) => {
              e.preventDefault();
              setOver(false);
              reorder.setOrder(moveById(reorder.order, e.dataTransfer.getData('text/plain'), field));
            }
          }
        : null)}
    >
      <span className="inline-flex items-center">{handle}{title}</span>
    </th>
  );
}
