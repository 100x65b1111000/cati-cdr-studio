import React from 'react';
import { ChevronDownRegular as CaretDown, ChevronUpRegular as CaretUp } from '@fluentui/react-icons';

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
        className={`inline-flex items-center gap-1 whitespace-nowrap px-3 py-3.5 transition-colors ${
          active ? 'text-k-accent-fg' : 'text-k-ink-muted hover:text-k-ink'
        }`}
      >
        {label}
        {active &&
          (sortAsc ? <CaretUp style={{ fontSize: 12 }} /> : <CaretDown style={{ fontSize: 12 }} />)}
      </button>
    </th>
  );
}
