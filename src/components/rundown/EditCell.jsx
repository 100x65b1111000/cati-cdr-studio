import React, { useEffect, useRef, useState } from 'react';

export default function EditCell({ value, onCommit, label }) {
  const [draft, setDraft] = useState(String(value ?? 0));
  const [editing, setEditing] = useState(false);
  const ref = useRef(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(String(value ?? 0));
  }, [value, editing]);

  const commit = () => {
    if (!editing) return;
    setEditing(false);
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setDraft(String(value ?? 0));
      return;
    }
    const parsed = parseInt(draft, 10);
    const next = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    if (next !== (value ?? 0)) onCommit(next);
  };

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      aria-label={label}
      value={draft}
      onFocus={() => setEditing(true)}
      onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          ref.current?.blur();
        } else if (e.key === 'Escape') {
          cancelledRef.current = true;
          ref.current?.blur();
        }
      }}
      className="num h-7 w-12 rounded-md border border-transparent bg-transparent text-right text-k-ink hover:border-k-hairline focus:border-k-accent focus:bg-k-sunken focus:outline-none"
    />
  );
}
