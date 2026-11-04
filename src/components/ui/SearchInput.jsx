import React from 'react';
import { GlyphX as X, GlyphSearch as MagnifyingGlass } from './Glyph';

export default function SearchInput({ value, onChange, label, placeholder = 'Search', className = '', id }) {
  const inputId = id || `search-${label || placeholder}`.replace(/\W+/g, '-');
  return (
    <div className={`relative min-w-0 flex-1 ${className}`}>
      <label htmlFor={inputId} className="sr-only">
        {label || placeholder}
      </label>
      <MagnifyingGlass
        style={{ fontSize: 15 }}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-k-ink-muted"
      />
      {/* Each overlay is only worth the width it actually covers: the glass ends at 25px
          on the left, the clear button is mounted on the right only once there is a value,
          and an empty field is exactly where the placeholder has to fit. */}
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`field w-full rounded py-1.5 pl-8 text-xs text-k-ink placeholder:text-k-ink-muted focus:border-k-accent-fg focus:outline-none ${
          value ? 'pr-7' : 'pr-3'
        }`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={`Clear ${label || placeholder}`}
          className="absolute right-1 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-k-ink-muted hover:bg-k-hairline/40 hover:text-k-ink"
        >
          <X style={{ fontSize: 14 }} />
        </button>
      )}
    </div>
  );
}
