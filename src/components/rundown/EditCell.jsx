import React, { useEffect, useRef, useState } from 'react';
import { CaretDown, CaretUp } from '@phosphor-icons/react';

const stepBtn =
  'glow-hover flex h-[9px] w-[11px] items-center justify-center rounded-[3px] leading-none text-k-ink-muted disabled:cursor-not-allowed disabled:opacity-35';

export default function EditCell({ value, onCommit, label, tone = 'text-k-ink' }) {
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

  // A caret click is already a decision, so it commits rather than leaving a draft to
  // lose on blur. preventDefault stops the button stealing focus between clicks.
  const nudge = (delta) => {
    const parsed = parseInt(draft, 10);
    const from = Number.isFinite(parsed) ? parsed : value ?? 0;
    const next = Math.max(0, from + delta);
    setDraft(String(next));
    if (next !== (value ?? 0)) onCommit(next);
  };
  const atFloor = (Number.isFinite(parseInt(draft, 10)) ? parseInt(draft, 10) : 0) <= 0;

  return (
    <span className="relative inline-flex align-middle">
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
        className={`num h-7 w-12 rounded-md border border-transparent bg-transparent py-0 pl-0 pr-[14px] text-center ${tone} hover:border-k-accent/70 hover:bg-k-accent/10 focus:border-k-accent focus:bg-k-sunken focus:outline-none`}
      />
      <span className="absolute inset-y-0 right-0 flex w-[13px] flex-col items-center justify-center gap-px pr-px">
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => nudge(1)}
          className={stepBtn}
        >
          <CaretUp size={8} weight="bold" />
        </button>
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={atFloor}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => nudge(-1)}
          className={stepBtn}
        >
          <CaretDown size={8} weight="bold" />
        </button>
      </span>
    </span>
  );
}
