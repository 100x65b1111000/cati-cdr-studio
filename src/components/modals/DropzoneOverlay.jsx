import React, { useState, useEffect } from 'react';
import { CloudArrowUpRegular as CloudArrowUp } from '@fluentui/react-icons';
import { useCdr } from '../../context/CdrContext';

export default function DropzoneOverlay() {
  const { handleFileDropOrSelect } = useCdr();
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        setIsDragging(false);
        dragCounter = 0;
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
    };

    const handleDrop = (e) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        handleFileDropOrSelect(file);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [handleFileDropOrSelect]);

  if (!isDragging) return null;

  return (
    <div className="animate-fade-in pointer-events-none fixed inset-0 z-50 flex items-center justify-center border-4 border-dashed border-k-accent-fg bg-k-page/80 p-6">
      <div className="animate-pop-up space-y-2 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-k-accent-fg/15 text-k-accent-fg">
          <CloudArrowUp style={{ fontSize: 30 }} />
        </div>
        <h2 className="text-base font-semibold text-k-ink">Drop the CDR CSV</h2>
        <p className="text-xs text-k-ink-muted">It parses and previews before anything is written.</p>
      </div>
    </div>
  );
}
