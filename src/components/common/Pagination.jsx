import React from 'react';
import { GlyphCaretDoubleLeft as CaretDoubleLeft, GlyphCaretDoubleRight as CaretDoubleRight, GlyphCaretLeft as CaretLeft, GlyphCaretRight as CaretRight } from '../ui/Glyph';

const btn =
  'hoverable rounded border border-k-hairline px-2 py-1 text-k-ink-muted active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-40';

const PAGE_SIZES = [10, 25, 50, 100];

export default function Pagination({ currentPage, totalItems, pageSize, onPageChange, onPageSizeChange }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  return (
    <div className="no-print flex flex-col items-center justify-between gap-2 border-t border-k-hairline bg-k-surface/40 px-4 py-3 text-xs text-k-ink-muted sm:flex-row">
      <div className="flex items-center gap-3">
        <span>
          <span className="num text-k-ink">{startItem}</span>
          {' to '}
          <span className="num text-k-ink">{endItem}</span>
          {' of '}
          <span className="num text-k-ink">{totalItems}</span>
        </span>

        {onPageSizeChange && (
          <label className="flex items-center gap-1.5">
            <span>Per page</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="num field rounded px-2 py-1 text-k-ink focus:border-k-accent-fg focus:outline-none"
            >
              {PAGE_SIZES.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button type="button" className={btn} onClick={() => onPageChange(1)} disabled={currentPage === 1} aria-label="First page">
          <CaretDoubleLeft style={{ fontSize: 12 }} />
        </button>
        <button type="button" className={btn} onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous page">
          <CaretLeft style={{ fontSize: 12 }} />
        </button>
        <span className="num px-2 text-k-ink">
          {currentPage} / {totalPages}
        </span>
        <button type="button" className={btn} onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} aria-label="Next page">
          <CaretRight style={{ fontSize: 12 }} />
        </button>
        <button type="button" className={btn} onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} aria-label="Last page">
          <CaretDoubleRight style={{ fontSize: 12 }} />
        </button>
      </div>
    </div>
  );
}
