import { parseRawCallRecords } from '../services/shiftCalculator';
import { replaceDataset } from './db';

/**
 * Turns CSV-shaped row dicts into a stored dataset. Both the uploaded file and the
 * generated demo arrive here in the same shape, and the normalisation is the app's own
 * parseRawCallRecords, so header aliases and skip rules have exactly one implementation
 * and the server can never disagree with what the browser then recalculates.
 */
export function ingest(rows, { filename, source }) {
  const calls = parseRawCallRecords(rows);
  return replaceDataset({
    filename,
    source,
    rows,
    calls,
    skipped: rows.length - calls.length
  });
}
