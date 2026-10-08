import React from 'react';
import { CheckCircle, XCircle, Info } from '@phosphor-icons/react';
import { useCdr } from '../../context/CdrContext';

const BY_TYPE = {
  success: { Icon: CheckCircle, tone: 'border-k-success text-k-success' },
  error: { Icon: XCircle, tone: 'border-k-danger text-k-danger' },
  info: { Icon: Info, tone: 'border-k-accent text-k-accent' }
};

export default function ToastContainer() {
  const { toasts, removeToast } = useCdr();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="no-print pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      {toasts.map(toast => {
        const { Icon, tone } = BY_TYPE[toast.type] || BY_TYPE.info;
        return (
          <button
            key={toast.id}
            type="button"
            onClick={() => removeToast(toast.id)}
            className={`panel animate-slide-in pointer-events-auto flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-left text-xs font-medium shadow-2xl ${tone}`}
          >
            <Icon size={16} className="shrink-0" />
            <span>{toast.message}</span>
          </button>
        );
      })}
    </div>
  );
}
