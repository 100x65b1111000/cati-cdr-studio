export const DEFAULT_DATE_RANGE = { preset: 'all', from: '', to: '' };

function key(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayKey() {
  return key(new Date());
}

export function offsetKey(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return key(d);
}

// Distinct shift dates present in analysis, ascending.
export function availableDates(analysis) {
  const set = new Set();
  Object.values(analysis || {}).forEach((byDate) => Object.keys(byDate).forEach((d) => set.add(d)));
  return Array.from(set).sort();
}

// Every date the range selects, ascending. Used as a membership set so filtering
// a call list costs one lookup per row instead of a comparison chain per row.
export function rangeDates(range, analysis) {
  const { preset, from, to } = range || DEFAULT_DATE_RANGE;
  if (preset === 'today') return [todayKey()];
  if (preset === 'last7') {
    const out = [];
    for (let i = 6; i >= 0; i--) out.push(offsetKey(i));
    return out;
  }
  if (preset === 'custom' && from && to) {
    const out = [];
    const cursor = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    while (cursor <= end && out.length < 400) {
      out.push(key(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }
  if (preset === 'custom') {
    return availableDates(analysis).filter((d) => (!from || d >= from) && (!to || d <= to));
  }
  return availableDates(analysis);
}

export function inDateRange(dateStr, range, dateSet) {
  const { preset, from, to } = range || DEFAULT_DATE_RANGE;
  if (preset === 'all' && !from && !to) return true;
  if (dateSet) return dateSet.has(dateStr);
  if (preset === 'today') return dateStr === todayKey();
  if (preset === 'last7') return dateStr >= offsetKey(6) && dateStr <= todayKey();
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}

export function rangeLabel(range, dates) {
  const { preset, from, to } = range || DEFAULT_DATE_RANGE;
  if (preset === 'today') return 'Today';
  if (preset === 'last7') return 'Last 7 days';
  if (preset === 'custom' && (from || to)) return `${from || dates[0] || '?'} to ${to || dates[dates.length - 1] || '?'}`;
  if (dates.length <= 1) return dates[0] || 'No dates';
  return `${dates[0]} to ${dates[dates.length - 1]}`;
}
