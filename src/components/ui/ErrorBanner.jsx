import React from 'react';
import { WarningCircle, X } from '@phosphor-icons/react';

export default function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-xl border border-k-danger/40 bg-k-danger/10 px-4 py-3 text-xs text-k-danger"
    >
      <WarningCircle size={16} className="mt-px shrink-0" />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss error" className="shrink-0 hover:opacity-70">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
