import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const GAP = 6;

let seq = 0;

/* A native `title=` is the cheapest tooltip there is and it reaches almost nobody: it
   needs a mouse, fires on no schedule, cannot be dismissed, and never appears on a
   touchscreen. Every one of these carried real data — a break window, a region split,
   what the Sample button loads.

   `aria-describedby` is wired to the panel while it is open, which is the moment a
   keyboard or screen-reader user has cause to ask what the thing they are on means.
   A permanently mounted hidden copy of the text was considered and rejected: it puts
   every tooltip's contents into the row's layout, and the panel it duplicates is one
   more node in the a11y tree reading the same words twice.

   The panel renders into a body portal at `position: fixed` because the tables scroll
   inside `overflow-auto` containers with their own stacking contexts, and an absolutely
   positioned child would be clipped by the row it belongs to. */
export default function Tip({ label, className = '', children, ...rest }) {
  const [id] = useState(() => `tip-${++seq}`);
  const [rect, setRect] = useState(null);
  const anchor = useRef(null);
  const open = rect !== null;

  const show = () => {
    const el = anchor.current;
    if (el) setRect(el.getBoundingClientRect());
  };
  const hide = () => setRect(null);

  useEffect(() => {
    if (!open) return;
    // Scroll and Esc both have to dismiss it: a floating panel that outruns its anchor,
    // or that the keyboard cannot get rid of, is a WCAG 1.4.13 failure either way.
    const onKey = (e) => {
      if (e.key === 'Escape') hide();
    };
    const onPointerDown = (e) => {
      if (anchor.current && !anchor.current.contains(e.target)) hide();
    };
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [open]);

  // A cell that has nothing to say still has to render its layout wrapper, or callers
  // that pass a computed summary would reflow when it comes back empty.
  if (!label)
    return (
      <span className={className} {...rest}>
        {children}
      </span>
    );

  return (
    <>
      <span
        ref={anchor}
        {...rest}
        aria-describedby={open ? id : undefined}
        className={className}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') show();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') hide();
        }}
        onFocus={show}
        onBlur={hide}
        onClick={show}
      >
        {children}
      </span>
      {open && <TipPanel id={id} label={label} rect={rect} />}
    </>
  );
}

function TipPanel({ id, label, rect }) {
  const ref = useRef(null);

  // Corrected in the frame it mounts, before the browser paints, so the estimate below
  // is never what the eye sees.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    let top = rect.top - GAP - height;
    if (top < 8) top = Math.min(rect.bottom + GAP, window.innerHeight - height - 8);
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8));
    el.style.top = `${Math.round(top)}px`;
    el.style.left = `${Math.round(left)}px`;
  }, [rect]);

  return createPortal(
    <span ref={ref} id={id} role="tooltip" className="tip no-print" style={{ top: rect.top, left: rect.left }}>
      {label}
    </span>,
    document.body
  );
}
