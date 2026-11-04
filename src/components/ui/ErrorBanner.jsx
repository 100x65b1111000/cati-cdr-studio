import React from 'react';
import { GlyphX as X, GlyphWarningCircle as WarningCircle } from './Glyph';

export default function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-k-danger/40 bg-k-danger/10 px-4 py-3 text-xs text-k-danger"
    >
      <WarningCircle style={{ fontSize: 16 }} className="mt-px shrink-0" />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="-my-1 flex size-6 shrink-0 items-center justify-center rounded hover:bg-k-danger/15 hover:opacity-100"
        >
          <X style={{ fontSize: 16 }} />
        </button>
      )}
    </div>
  );
}
