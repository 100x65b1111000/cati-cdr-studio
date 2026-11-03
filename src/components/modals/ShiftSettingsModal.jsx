import React, { useState, useEffect } from 'react';
import { HistoryRegular as ClockCounterClockwise } from '@fluentui/react-icons';
import { useCdr } from '../../context/CdrContext';
import { SHIFT_PRESETS, DEFAULT_SHIFT_CONFIG } from '../../constants/defaultData';
import Modal from '../ui/Modal';

const field = 'field w-full rounded-md px-3 py-2 text-xs text-k-ink focus:border-k-accent-fg focus:outline-none';

const D = DEFAULT_SHIFT_CONFIG;

export default function ShiftSettingsModal() {
  const { isSettingsOpen, setIsSettingsOpen, shiftConfig, updateShiftConfig } = useCdr();

  // `??` not `||`: a same-day shift is stored as endDay 0, which `||` erases to 1
  const [startDay, setStartDay] = useState(shiftConfig.shiftStartDay ?? D.shiftStartDay);
  const [startTime, setStartTime] = useState(shiftConfig.shiftStartTime || D.shiftStartTime);
  const [endDay, setEndDay] = useState(shiftConfig.shiftEndDay ?? D.shiftEndDay);
  const [endTime, setEndTime] = useState(shiftConfig.shiftEndTime || D.shiftEndTime);

  useEffect(() => {
    if (!isSettingsOpen) return;
    setStartDay(shiftConfig.shiftStartDay ?? D.shiftStartDay);
    setStartTime(shiftConfig.shiftStartTime || D.shiftStartTime);
    setEndDay(shiftConfig.shiftEndDay ?? D.shiftEndDay);
    setEndTime(shiftConfig.shiftEndTime || D.shiftEndTime);
  }, [isSettingsOpen, shiftConfig]);

  if (!isSettingsOpen) return null;

  const close = () => setIsSettingsOpen(false);

  const [startHH, startMM] = (startTime || D.shiftStartTime).split(':').map(Number);
  const [endHH, endMM] = (endTime || D.shiftEndTime).split(':').map(Number);
  const startSecs = startDay * 86400 + (startHH || 0) * 3600 + (startMM || 0) * 60;
  const endSecs = endDay * 86400 + (endHH || 0) * 3600 + (endMM || 0) * 60;

  let diffSecs = endSecs - startSecs;
  if (diffSecs <= 0) diffSecs += 86400;

  const durHours = Math.floor(diffSecs / 3600);
  const durMins = Math.floor((diffSecs % 3600) / 60);
  const dayDiff = endDay - startDay;

  const applyPreset = (preset) => {
    setStartDay(preset.startDay);
    setStartTime(preset.startTime);
    setEndDay(preset.endDay);
    setEndTime(preset.endTime);
  };

  const handleSave = () => {
    updateShiftConfig({
      breakThresholdMinutes: shiftConfig.breakThresholdMinutes || D.breakThresholdMinutes,
      shiftStartDay: Number.isFinite(startDay) ? startDay : D.shiftStartDay,
      shiftStartTime: startTime || D.shiftStartTime,
      shiftEndDay: Number.isFinite(endDay) ? endDay : D.shiftEndDay,
      shiftEndTime: endTime || D.shiftEndTime
    });
    close();
  };

  const footer = (
    <>
      <button
        type="button"
        onClick={close}
        className="hoverable rounded border border-k-hairline bg-k-surface-hover/60 px-3.5 py-2 text-xs font-medium text-k-ink active:translate-y-[1px]"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSave}
        className="rounded bg-k-accent px-3.5 py-2 text-xs font-semibold text-k-accent-ink transition-colors hover:bg-k-accent/90 active:translate-y-[1px]"
      >
        Apply and recalculate
      </button>
    </>
  );

  return (
    <Modal
      title="Shift window"
      subtitle="Controls which calls land on which shift date"
      onClose={close}
      footer={footer}
      width="max-w-xl"
    >
      <div className="space-y-4 text-xs">
        <div>
          <h3 className="mb-2 text-xs font-bold text-k-ink-muted">Presets</h3>
          {['Same Day', 'Multi Day'].map((group) => (
            <div key={group} className="mb-2">
              <p className="mb-1 text-2xs text-k-ink-muted">{group}</p>
              <div className="grid grid-cols-4 gap-1.5">
                {SHIFT_PRESETS.filter((p) => p.group === group).map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="num rounded border border-k-hairline bg-k-surface/60 px-2 py-1.5 text-meta text-k-ink transition-colors hover:border-k-accent-fg hover:text-k-accent-fg active:translate-y-[1px]"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="shift-start-day" className="mb-1 block text-meta text-k-ink-muted">
              Start day
            </label>
            <select
              id="shift-start-day"
              value={startDay}
              onChange={(e) => setStartDay(parseInt(e.target.value, 10))}
              className={`${field} num`}
            >
              <option value="0">Day 1</option>
            </select>
          </div>
          <div>
            <label htmlFor="shift-start-time" className="mb-1 block text-meta text-k-ink-muted">
              Start time
            </label>
            <input
              id="shift-start-time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={`${field} num`}
            />
          </div>
          <div>
            <label htmlFor="shift-end-day" className="mb-1 block text-meta text-k-ink-muted">
              End day
            </label>
            <select
              id="shift-end-day"
              value={endDay}
              onChange={(e) => setEndDay(parseInt(e.target.value, 10))}
              className={`${field} num`}
            >
              <option value="0">Day 1 (same day)</option>
              <option value="1">Day 2 (overnight)</option>
              <option value="2">Day 3</option>
            </select>
          </div>
          <div>
            <label htmlFor="shift-end-time" className="mb-1 block text-meta text-k-ink-muted">
              End time
            </label>
            <input
              id="shift-end-time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={`${field} num`}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border border-k-hairline bg-k-sunken/60 px-4 py-3 text-meta">
          <span className="inline-flex items-center gap-1.5 text-k-ink">
            <ClockCounterClockwise style={{ fontSize: 14 }} className="text-k-accent-fg" />
            Shift duration <b className="num text-k-accent-fg">{durHours}h {durMins}m</b>
          </span>
          <span className="num text-k-ink-muted">
            {dayDiff > 0 ? `Rollover +${dayDiff} day${dayDiff > 1 ? 's' : ''}` : 'Rollover none'}
          </span>
        </div>

        <p className="text-meta text-k-ink-muted">
          Calls inside this window group to the shift start date. The idle break threshold stays in the
          rundown toolbar.
        </p>
      </div>
    </Modal>
  );
}
