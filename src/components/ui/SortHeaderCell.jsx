import React from 'react';
import {
  ChevronDownRegular as CaretDown,
  ChevronUpRegular as CaretUp,
  ReOrderDotsHorizontalRegular as Grip
} from '@fluentui/react-icons';
import useDragReorder from '../../hooks/useDragReorder';

export default function SortHeaderCell({
  label,
  field,
  sortField,
  sortAsc,
  onSort,
  align = 'left',
  className = '',
  sortable = true,
  order,
  setOrder,
  shownIds,
  dragging,
  setDragging
}) {
  const { moving, land, handle, target } = useDragReorder({
    id: field,
    label,
    order,
    setOrder,
    shownIds,
    axis: 'x',
    dragging,
    setDragging
  });
  const active = sortable && sortField === field;
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  const title = sortable ? (
    /* The cell's padding lives on the button, not on the th, so the whole header
       cell is the sort target rather than a two-word glyph floating in the middle
       of it. Same pixels, same height, 32x16 becomes a full-cell hit area. */
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`inline-flex items-center gap-1 whitespace-nowrap px-3 py-2 transition-colors ${
        active ? 'text-k-accent-fg' : 'text-k-ink-muted hover:text-k-ink'
      }`}
    >
      {label}
      {active &&
        (sortAsc ? <CaretUp style={{ fontSize: 12 }} /> : <CaretDown style={{ fontSize: 12 }} />)}
    </button>
  ) : (
    <span className="inline-flex items-center whitespace-nowrap px-3 py-2 text-k-ink-muted">
      {label}
    </span>
  );

  return (
    // The handle rides above the name and the whole cell is the landing pad: you drop a
    // column onto the header it should take. A `draggable` <button> never starts a drag
    // in Firefox, so the handle is a span that answers the keyboard itself. The moving
    // column is tinted from head to foot by the table body, so the cell repeats it; the
    // bar marks the slot the dropped column takes, on whichever side of this cell the
    // pointer is.
    <th
      scope="col"
      aria-label={label}
      aria-sort={sortable ? (active ? (sortAsc ? 'ascending' : 'descending') : 'none') : undefined}
      className={`relative ${alignClass} ${className} ${moving ? 'bg-k-accent-fg/15' : ''} ${
        land ? 'bg-k-accent-fg/10' : ''
      }`}
      {...target}
    >
      {land && (
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 w-[3px] bg-k-accent-fg ${land === 'after' ? 'right-0' : 'left-0'}`}
        />
      )}
      <span className="flex flex-col items-center">
        <span {...handle} className="hoverable grid h-6 w-6 shrink-0 cursor-grab place-items-center rounded text-k-ink-faint active:cursor-grabbing print:hidden">
          <Grip style={{ fontSize: 14 }} />
        </span>
        {title}
      </span>
    </th>
  );
}
