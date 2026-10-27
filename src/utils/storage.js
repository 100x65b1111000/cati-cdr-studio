const STORAGE_PREFIX = 'cati_cdr_studio_';

export function saveToStorage(key, value) {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(STORAGE_PREFIX + key, serialized);
  } catch (err) {
    console.warn(`[storage] Failed to save key "${key}" to localStorage:`, err);
  }
}

export function removeFromStorage(key) {
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
  } catch (err) {
    console.warn(`[storage] Failed to remove key "${key}" from localStorage:`, err);
  }
}
export function loadFromStorage(key, defaultValue) {
  try {
    const item = localStorage.getItem(STORAGE_PREFIX + key);
    if (item === null) return defaultValue;
    return JSON.parse(item);
  } catch (err) {
    console.warn(`[storage] Failed to load key "${key}" from localStorage:`, err);
    return defaultValue;
  }
}
