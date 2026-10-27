import React from 'react';
import { CaretUp, CaretDown } from '@phosphor-icons/react';

export default function SortHeaderCell({
  label,
  field,
  sortField,
  sortAsc,
  onSort,
  align = 'left',
  className = ''
}) {
  const active = sortField === field;
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <th
      scope="col"
      aria-sort={active ? (sortAsc ? 'ascending' : 'descending') : 'none'}
      className={`font-semibold ${alignClass} ${className}`}
    >
      {/* The cell's padding lives on the button, not on the th, so the whole header
          cell is the sort target rather than a two-word glyph floating in the middle
          of it. Same pixels, same height, 32x16 becomes a full-cell hit area. */}
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 whitespace-nowrap px-3 py-3.5 uppercase tracking-wider transition-colors ${
          active ? 'text-k-accent' : 'text-k-ink-muted hover:text-k-ink'
        }`}
      >
        {label}
        {active &&
          (sortAsc ? <CaretUp size={12} weight="bold" /> : <CaretDown size={12} weight="bold" />)}
      </button>
    </th>
  );
}
