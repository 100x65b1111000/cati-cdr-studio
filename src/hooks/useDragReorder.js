import { useRef, useState } from 'react';
import { moveById, stepById } from '../utils/columnOrder';

// One drag source (the handle) and one landing pad (the row it sits in), shared by the
// table head and the Columns menu so both drag exactly the same way.
//
// `lit` is the id the surface has under its cursor or in flight, lifted out of here
// because the head needs it too: the highlight has to cover every cell of the column,
// not just the header the handle lives in. `axis` is the direction that surface runs in,
// and `shownIds` is the sequence the user can see, which the keyboard steps over.
export default function useDragReorder({ id, label, order, setOrder, shownIds, axis, lit, setLit }) {
  const [land, setLand] = useState(null);
  // A drag owns the highlight from dragstart to dragend. The pointer leaves the handle
  // the moment the drag image takes over, so a hover leaving must not clear what the
  // drag just set.
  const inFlight = useRef(false);
  const moving = lit === id;
  const idle = () => {
    if (inFlight.current) return;
    setLit(null);
    setLand(null);
  };
  const clear = () => {
    inFlight.current = false;
    setLit(null);
    setLand(null);
  };

  // Which half of the cell the pointer is on decides the slot the dropped column takes:
  // the near half displaces this one, the far half lands behind it. Without that second
  // half a column can never be moved past the last one.
  const side = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const at = axis === 'x' ? e.clientX - box.left : e.clientY - box.top;
    return at < (axis === 'x' ? box.width : box.height) / 2 ? 'before' : 'after';
  };

  return {
    moving,
    // Dropping a column onto its own slot is a no-op, so that slot gets no marker.
    land: moving ? null : land,
    handle: {
      role: 'button',
      tabIndex: 0,
      'aria-label': `Reorder ${label} column. Arrow keys move it.`,
      draggable: true,
      // Hovering the handle lights the column it would move, so the gesture names its
      // subject before it starts. Focus does the same for the keyboard route, which
      // otherwise moves a column you cannot tell from its neighbours.
      onMouseEnter: () => setLit(id),
      onMouseLeave: idle,
      onFocus: () => setLit(id),
      onBlur: idle,
      onDragStart: (e) => {
        inFlight.current = true;
        setLit(id);
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
        // The row, not the 14px glyph, is what should travel with the pointer.
        e.dataTransfer.setDragImage(e.currentTarget.parentElement, 8, 8);
      },
      onDragEnd: clear,
      onKeyDown: (e) => {
        // Plain arrows, once the handle has focus: Alt+Left is the browser's own Back,
        // and a reorder shortcut that leaves the app is worse than none.
        const delta = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
        if (!delta) return;
        e.preventDefault();
        setOrder(stepById(order, shownIds, id, delta));
      }
    },
    target: {
      onDragOver: (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const next = side(e);
        if (next !== land) setLand(next);
      },
      // Entering a child of the same row bubbles a dragleave out of it, so only a
      // leave that ends outside may clear the marker.
      onDragLeave: (e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setLand(null);
      },
      // The drop asks the event rather than the marker state: a drop can arrive without
      // a fresh dragover, and stale state would put the column on the wrong side.
      onDrop: (e) => {
        e.preventDefault();
        const after = side(e) === 'after';
        clear();
        setOrder(moveById(order, e.dataTransfer.getData('text/plain'), id, after));
      }
    }
  };
}
