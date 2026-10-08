import React, { useEffect, useRef } from 'react';
import { X } from '@phosphor-icons/react';
import useDismissOverlay from '../../hooks/useDismissOverlay';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ title, subtitle, onClose, children, footer, width = 'max-w-3xl' }) {
  const overlayRef = useDismissOverlay(onClose, true);
  const panelRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    const panel = panelRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const first = panel.querySelector(FOCUSABLE);
    (first || panel).focus();

    function onKeydown(e) {
      if (e.key !== 'Tab') return;
      const items = Array.from(panel.querySelectorAll(FOCUSABLE));
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }

    panel.addEventListener('keydown', onKeydown);
    return () => {
      panel.removeEventListener('keydown', onKeydown);
      document.body.style.overflow = previousOverflow;
      if (openerRef.current && typeof openerRef.current.focus === 'function') {
        openerRef.current.focus();
      }
    };
  }, []);

  return (
    <div
      ref={overlayRef}
      className="animate-fade-in fixed inset-0 z-50 overflow-y-auto bg-k-page/80 px-4 py-10 backdrop-blur-xl sm:px-6"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`panel animate-pop-up mx-auto w-full ${width} rounded-2xl shadow-2xl outline-none`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-k-hairline px-6 py-4">
          <div>
            <h2 className="text-sm font-bold text-k-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-k-ink-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg bg-k-surface-hover/80 p-1.5 text-k-ink-muted transition-colors hover:bg-k-surface-hover hover:text-k-ink"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-k-hairline px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
