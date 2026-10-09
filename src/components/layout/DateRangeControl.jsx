import React from 'react';
import { Calendar } from '@phosphor-icons/react';
import { useCdr } from '../../context/CdrContext';
import Segmented from '../ui/Segmented';
import FilterPopover from '../ui/FilterPopover';
import DateRangePicker from '../ui/DateRangePicker';
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
          <FilterPopover
            label={`${dateRange.from || 'start'} – ${dateRange.to || 'end'}`}
            icon={Calendar}
            width="w-[16.5rem]"
          >
            <DateRangePicker
              dates={dates}
              from={dateRange.from}
              to={dateRange.to}
              onPick={(from, to) => setDateRange({ ...dateRange, from, to })}
            />
          </FilterPopover>
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
