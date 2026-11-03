import React, { useEffect, useRef, useState } from 'react';
import Stepper from '../ui/Stepper';

/* The edge is `current` — the value's own hue, throughput amber on one cell and
   success green on the other. A neutral hairline would make an editable number look
   like any other read-only stat, and the app accent would light a blue edge on a green
   value. Same reasoning as the break-threshold pill. */

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
        className={`num h-7 w-12 rounded border border-current/25 bg-transparent py-0 pl-0 pr-[14px] text-center ${tone} hover:border-current/70 hover:bg-current/10 focus:border-current focus:bg-k-sunken focus:outline-none`}
      />
      <Stepper
        upLabel={`Increase ${label}`}
        downLabel={`Decrease ${label}`}
        downDisabled={atFloor}
        onUp={() => nudge(1)}
        onDown={() => nudge(-1)}
      />
    </span>
  );
}
