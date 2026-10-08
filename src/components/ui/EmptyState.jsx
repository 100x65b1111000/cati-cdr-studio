import React from 'react';

export default function EmptyState({ title, body, action }) {
  return (
    <div className="px-4 py-14 text-center">
      <p className="text-sm font-medium text-k-ink">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-[46ch] text-xs text-k-ink-muted">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
