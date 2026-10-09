import React, { useRef } from 'react';
import { UploadSimple, Flask } from '@phosphor-icons/react';
import { useCdr } from '../../context/CdrContext';
import { COLOR_SCHEMES } from '../../theme/colorSchemes';

// The upload label owns the file input and the parsing state.
export default function DataActions() {
  const { isParsing, loadDemoData, handleFileDropOrSelect, colorScheme } = useCdr();
  const fileInputRef = useRef(null);

  function onFileInputChange(e) {
    const file = e.target.files?.[0];
    if (file) handleFileDropOrSelect(file);
    e.target.value = '';
  }

  return (
    <div className="flex gap-2">
      <label
        className="glow-accent flex cursor-pointer items-center gap-2 rounded-lg bg-k-accent px-3.5 py-2 text-xs font-medium text-k-accent-ink transition-colors hover:bg-k-accent/90 active:translate-y-[1px]"
      >
        <UploadSimple size={16} />
        <span>{isParsing ? 'Parsing CSV' : 'Upload CDR CSV'}</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={onFileInputChange}
          className="hidden"
        />
      </label>
      <button
        type="button"
        onClick={loadDemoData}
        title={COLOR_SCHEMES[colorScheme].label}
        className="flex items-center gap-2 rounded-lg border border-k-accent/55 bg-k-accent/12 px-3.5 py-2 text-xs font-medium text-k-accent transition-colors hover:border-k-accent/80 hover:bg-k-accent/20 active:translate-y-[1px]"
      >
        <Flask size={15} className="text-k-accent" />
        <span>Sample data</span>
      </button>
    </div>
  );
}
