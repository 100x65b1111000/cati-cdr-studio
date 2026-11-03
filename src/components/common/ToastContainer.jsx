import React from 'react';
import { CheckmarkCircleRegular as CheckCircle, DismissCircleRegular as XCircle, InfoRegular as Info } from '@fluentui/react-icons';
import { useCdr } from '../../context/CdrContext';

const BY_TYPE = {
  success: { Icon: CheckCircle, tone: 'border-k-success text-k-success', hue: 'var(--k-success)' },
  error: { Icon: XCircle, tone: 'border-k-danger text-k-danger', hue: 'var(--k-danger)' },
  info: { Icon: Info, tone: 'border-k-accent-fg text-k-accent-fg', hue: 'var(--k-accent-fg)' }
};

export default function ToastContainer() {
  const { toasts, removeToast } = useCdr();

  // The live region has to be in the DOM *before* the message lands in it. Returning
  // null while idle meant every toast was a brand new node rather than a change to an
  // announced one, which is the case screen readers are least reliable at. An empty
  // fixed box costs nothing: it has no size and `pointer-events-none`.
  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print pointer-events-none fixed bottom-20 right-4 z-[60] flex flex-col gap-2 lg:bottom-4"
    >
      {(toasts || []).map((toast) => {
        const { Icon, tone, hue } = BY_TYPE[toast.type] || BY_TYPE.info;
        return (
          <button
            key={toast.id}
            type="button"
            onClick={() => removeToast(toast.id)}
            style={{ '--tone': hue }}
            className={`panel hoverable animate-slide-in pointer-events-auto flex items-center gap-2 rounded-md px-3.5 py-2.5 text-left text-xs font-medium active:translate-y-[1px] ${tone}`}
          >
            <Icon style={{ fontSize: 16 }} className="shrink-0" />
            <span>{toast.message}</span>
          </button>
        );
      })}
    </div>
  );
}
