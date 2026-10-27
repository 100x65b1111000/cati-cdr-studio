import React from 'react';
import Chip from './Chip';

const TILE = {
  accent: 'border-k-accent/25 bg-k-accent/10 text-k-accent',
  success: 'border-k-success/25 bg-k-success/10 text-k-success',
  talk: 'border-k-talk/25 bg-k-talk/10 text-k-talk',
  'break-time': 'border-k-break-time/25 bg-k-break-time/10 text-k-break-time',
  throughput: 'border-k-throughput/25 bg-k-throughput/10 text-k-throughput',
  region: 'border-k-region/25 bg-k-region/10 text-k-region',
  danger: 'border-k-danger/25 bg-k-danger/10 text-k-danger'
};

export default function MetricStrip({ items }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {items.map(({ label, value, chips = [], Icon, role = 'accent' }) => (
        <div
          key={label}
          className="panel lift relative flex flex-col overflow-hidden rounded-2xl border border-k-hairline p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-medium text-k-ink-muted">{label}</div>
              <div className="num mt-1 whitespace-nowrap text-xl font-bold leading-tight text-k-ink">{value}</div>
            </div>
            {Icon && (
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${TILE[role]}`}
              >
                <Icon size={20} />
              </div>
            )}
          </div>
          {chips.length > 0 && (
            <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
              {chips.map(({ text, tone = role }) => (
                <Chip key={text} tone={tone}>
                  {text}
                </Chip>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
