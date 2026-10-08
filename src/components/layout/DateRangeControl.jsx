import React from 'react';
import { useCdr } from '../../context/CdrContext';
import Segmented from '../ui/Segmented';
import { availableDates, inDateRange, todayKey } from '../../utils/dateRange';

const PRESETS = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'last7', label: '7d' },
  { id: 'custom', label: 'Custom' }
];

export default function DateRangeControl() {
  const { analysis, dateRange, setDateRange } = useCdr();
  const dates = availableDates(analysis);

  const pick = (preset) => {
    if (preset === 'custom') {
      const from = dateRange.from || dates[0] || todayKey();
      const to = dateRange.to || dates[dates.length - 1] || todayKey();
      setDateRange({ preset: 'custom', from, to });
      return;
    }
    setDateRange({ preset, from: '', to: '' });
  };

  const inRange = dates.filter(d => inDateRange(d, dateRange)).length;

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <Segmented label="Date range" options={PRESETS} value={dateRange.preset} onChange={pick} />

      {dateRange.preset === 'custom' && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateRange.from}
            min={dates[0]}
            max={dateRange.to || dates[dates.length - 1]}
            onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
            className="num glass-input rounded-lg px-2.5 py-1.5 text-xs text-k-ink focus:border-k-accent"
          />
          <span className="text-xs text-k-ink-muted">to</span>
          <input
            type="date"
            value={dateRange.to}
            min={dateRange.from || dates[0]}
            max={dates[dates.length - 1]}
            onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
            className="num glass-input rounded-lg px-2.5 py-1.5 text-xs text-k-ink focus:border-k-accent"
          />
          <button
            type="button"
            onClick={() => setDateRange({ preset: 'last7', from: '', to: '' })}
            className="text-xs text-k-ink-muted underline-offset-2 hover:text-k-ink hover:underline"
          >
            reset
          </button>
        </div>
      )}

      <span className="num text-xs text-k-ink-muted">
        {inRange} of {dates.length} dates
      </span>
    </div>
  );
}
