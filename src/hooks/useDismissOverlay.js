import { useEffect, useRef } from 'react';

// Escape, or a mousedown outside `ref`, closes the popup: the dialog panel for a modal,
// the trigger-and-menu wrapper for an anchored popover. onClose is read through a ref so
// the owner re-rendering never re-subscribes the listeners.
export default function useDismissOverlay(onClose, active, ref) {
  const latest = useRef(onClose);
  latest.current = onClose;

  useEffect(() => {
    if (!active) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') latest.current();
    }
    function onMouseDown(e) {
      const el = ref.current;
      if (!el || !el.contains(e.target)) latest.current();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [active, ref]);
}
