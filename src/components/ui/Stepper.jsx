import React from 'react';
import { CaretDown, CaretUp } from '@phosphor-icons/react';

/* The up/down pair that rides the right edge of a numeric field. Two copies of this
   existed — one in EditCell, one in the break-threshold pill — down to a byte-identical
   `stepBtn` string, which is how they drifted.

   Each button fills half of the field's 28px height and the 13px column, so the pair
   tiles without overlapping and the layout width never moves. Growing the hit box to
   24x24 is geometrically impossible there: two stacked 24px boxes in a 28px column
   collide, and widening the column re-wraps the rundown toolbar, which has 5px of
   slack on this field. The exception is WCAG 2.5.8's own — the same value can be
   typed into the field beside them, which is a >=24px equivalent control. */
export default function Stepper({ onUp, onDown, upLabel, downLabel, upDisabled, downDisabled }) {
  const btn =
    'hoverable flex h-1/2 w-[13px] items-center justify-center rounded-[3px] leading-none text-k-ink-muted disabled:cursor-not-allowed disabled:opacity-35';
  // A caret click is already a decision, so it must not steal the field's focus and
  // leave the draft mid-edit between clicks. The action stays on onClick.
  const noFocus = (e) => e.preventDefault();
  return (
    <span className="absolute inset-y-0 right-0 flex w-[13px] flex-col items-center">
      <button type="button" aria-label={upLabel} disabled={upDisabled} onMouseDown={noFocus} onClick={onUp} className={btn}>
        <CaretUp size={8} weight="bold" />
      </button>
      <button type="button" aria-label={downLabel} disabled={downDisabled} onMouseDown={noFocus} onClick={onDown} className={btn}>
        <CaretDown size={8} weight="bold" />
      </button>
    </span>
  );
}
