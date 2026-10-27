import React from 'react';
import { MagnifyingGlass, X } from '@phosphor-icons/react';

export default function SearchInput({
  value,
  onChange,
  label,
  placeholder = 'Search',
  className = '',
  id,
  primary = false
}) {
  const inputId = id || `search-${label || placeholder}`.replace(/\W+/g, '-');
  return (
    <div className={`relative min-w-0 flex-1 ${className}`}>
      <label htmlFor={inputId} className="sr-only">
        {label || placeholder}
      </label>
      <MagnifyingGlass
        size={15}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-k-ink-muted"
      />
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-search-primary={primary || undefined}
        className="field w-full rounded-lg py-1.5 pl-8 pr-8 text-xs text-k-ink placeholder:text-k-ink-muted focus:border-k-accent focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={`Clear ${label || placeholder}`}
          className="absolute right-1 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-k-ink-muted hover:bg-k-hairline/40 hover:text-k-ink"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
