import React from 'react';
import { UploadSimple, Flask } from '@phosphor-icons/react';
import { useCdr } from '../../context/CdrContext';
import Tip from '../ui/Tip';

// The upload label owns the file input and the parsing state.
export default function DataActions() {
  const { isParsing, loadDemoData, handleFileDropOrSelect } = useCdr();

  function onFileInputChange(e) {
    const file = e.target.files?.[0];
    if (file) handleFileDropOrSelect(file);
    e.target.value = '';
  }

  return (
    <div className="flex gap-2">
      <label
        className="flex cursor-pointer items-center gap-2 rounded-lg bg-k-accent px-3.5 py-2 text-xs font-medium text-k-accent-ink transition-colors hover:bg-k-accent/90 active:translate-y-[1px]"
      >
        <UploadSimple size={16} />
        <span aria-busy={isParsing || undefined}>{isParsing ? 'Parsing CSV' : 'Upload CDR CSV'}</span>
        <input
          type="file"
          accept=".csv"
          onChange={onFileInputChange}
          className="hidden"
        />
      </label>
      <Tip
        className="inline-flex"
        label="Load a generated CDR to explore the views"
      >
        <button
          type="button"
          onClick={loadDemoData}
          className="flex items-center gap-2 rounded-lg border border-k-accent/55 bg-k-surface px-3.5 py-2 text-xs font-medium text-k-accent transition-colors hover:border-k-accent hover:bg-k-surface-hover active:translate-y-[1px]"
        >
          <Flask size={15} className="text-k-accent" />
          <span>Sample data</span>
        </button>
      </Tip>
    </div>
  );
}
