import React, { useState } from 'react';
import { useCdr } from '../../context/CdrContext';
import Modal from '../ui/Modal';

const field = 'field w-full rounded-lg px-3 py-2 text-xs text-k-ink focus:border-k-accent focus:outline-none';

export default function AddAgentModal() {
  const { isAddAgentOpen, setIsAddAgentOpen, extNameMap, updateExtMapping, addToast } = useCdr();
  const [extension, setExtension] = useState('');
  const [agentName, setAgentName] = useState('');
  const [error, setError] = useState('');

  if (!isAddAgentOpen) return null;

  const close = () => {
    setIsAddAgentOpen(false);
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanExt = extension.trim();
    const cleanName = agentName.trim() || `Agent ${cleanExt}`;

    if (!cleanExt) {
      setError('Enter an extension ID.');
      return;
    }
    if (extNameMap[cleanExt]) {
      setError(`${cleanExt} is already mapped to ${extNameMap[cleanExt]}.`);
      return;
    }

    updateExtMapping(cleanExt, cleanName);
    addToast(`Mapped ${cleanExt} to ${cleanName}`, 'success');
    setExtension('');
    setAgentName('');
    setError('');
    close();
  };

  return (
    <Modal title="Extension mapping" subtitle="Name an extension so it reads as a person" onClose={close} width="max-w-sm">
      {/* `noValidate` because `required` alone lets the browser answer an empty submit
          with its own bubble and `handleSubmit` never runs — so the duplicate-extension
          message appeared for one mistake and a native popup for the other. Now every
          rejection is this form's words, in this form's place. */}
      <form onSubmit={handleSubmit} noValidate className="space-y-3 text-xs">
        <div>
          <label htmlFor="agent-ext" className="mb-1 block text-k-ink-muted">
            Extension ID <span className="text-k-critical">*</span>
          </label>
          <input
            id="agent-ext"
            type="text"
            required
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? 'agent-ext-error' : undefined}
            placeholder="1040421"
            value={extension}
            onChange={(e) => setExtension(e.target.value)}
            className={`${field} num${error ? ' border-k-danger' : ''}`}
            autoFocus
          />
          {/* Inside the field's own block, not under both inputs: an error that lands
              below the field it is *not* about gets read as advice about the next one. */}
          {error && (
            <p id="agent-ext-error" role="alert" className="mt-1 text-meta text-k-danger">
              {error}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="agent-name" className="mb-1 block text-k-ink-muted">
            Agent name
          </label>
          <input
            id="agent-name"
            type="text"
            placeholder="Optional, falls back to Agent {id}"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            className={field}
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={close}
            className="hoverable rounded-lg border border-k-hairline-strong bg-k-surface-hover/60 px-3.5 py-2 text-xs font-medium text-k-ink active:translate-y-[1px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-k-accent px-3.5 py-2 text-xs font-semibold text-k-accent-ink transition-opacity hover:opacity-90 active:translate-y-[1px]"
          >
            Add mapping
          </button>
        </div>
      </form>
    </Modal>
  );
}
