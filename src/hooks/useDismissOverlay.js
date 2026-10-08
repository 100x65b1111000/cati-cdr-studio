import { useEffect, useRef } from 'react';

// Close overlay popups on Escape or on mousedown on the overlay backdrop
// (target === overlay itself, clicks inside the panel are ignored).
export default function useDismissOverlay(onClose, active) {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!active) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    function onMouseDown(e) {
      if (overlayRef.current && e.target === overlayRef.current) onClose();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [active, onClose]);

  return overlayRef;
}
