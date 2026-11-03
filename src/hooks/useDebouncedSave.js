import { useEffect } from 'react';
import { saveToStorage } from '../utils/storage';

// Every keystroke and every pick would otherwise write the whole view state again.
export default function useDebouncedSave(key, value) {
  useEffect(() => {
    const id = setTimeout(() => saveToStorage(key, value), 400);
    return () => clearTimeout(id);
  }, [key, value]);
}
