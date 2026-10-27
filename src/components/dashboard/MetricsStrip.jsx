import React, { useMemo } from 'react';
import { Phone, CheckCircle, Timer, Coffee, Pulse, Gauge } from '@phosphor-icons/react';
import { useCdr } from '../../context/CdrContext';
import { deriveMetrics } from '../../services/metrics';
import { formatDurationCompact } from '../../utils/timeFormatter';
import MetricStrip from '../ui/MetricStrip';

export default function MetricsStrip({ dayScope = '' }) {
  const { analysis, dateRange } = useCdr();
  const metrics = useMemo(() => deriveMetrics(analysis, dateRange, dayScope), [analysis, dateRange, dayScope]);

  return (
    <MetricStrip
      items={[
        {
          label: 'Calls',
          value: metrics.totalCalls,
          Icon: Phone,
          role: 'accent',
          chips: [{ text: `${metrics.placed} out` }, { text: `top ${metrics.topRegion}`, tone: 'region' }]
        },
        {
          label: 'Connected',
          value: `${metrics.rate}%`,
          Icon: CheckCircle,
          role: 'success',
          chips: [
            { text: `${metrics.connected} answered`, tone: 'success' },
            { text: `${metrics.notConnected} missed`, tone: 'danger' }
          ]
        },
        {
          label: 'Talk',
          value: formatDurationCompact(metrics.talkSec),
          Icon: Timer,
          role: 'talk',
          chips: [
            { text: `avg ${formatDurationCompact(metrics.avgTalkSec)}` },
            { text: `${metrics.talkShare} of active`, tone: 'throughput' }
          ]
        },
        {
          label: 'Break',
          value: formatDurationCompact(metrics.breakSec),
          Icon: Coffee,
          role: 'break-time',
          chips: [
            { text: `${metrics.breaksCount} logged` },
            { text: `longest ${formatDurationCompact(metrics.longestBreakSec)}`, tone: 'danger' }
          ]
        },
        {
          label: 'Net active',
          value: formatDurationCompact(metrics.netActiveSec),
          Icon: Pulse,
          role: 'region',
          chips: [
            { text: `${formatDurationCompact(metrics.perAgentNet)} /agent` },
            { text: `${metrics.spanShare} of span`, tone: 'accent' }
          ]
        },
        {
          label: 'Calls / hour',
          value: metrics.perHour,
          Icon: Gauge,
          role: 'throughput',
          chips: [
            { text: `best ${metrics.bestHour}/h` },
            { text: `${metrics.agents} agents`, tone: 'accent' }
          ]
        }
      ]}
    />
  );
}
