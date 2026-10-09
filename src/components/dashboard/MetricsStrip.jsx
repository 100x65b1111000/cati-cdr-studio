import React, { useMemo } from 'react';
import { Phone, CheckCircle, Timer, Coffee, Pulse, Gauge } from '@phosphor-icons/react';
import { useCdr } from '../../context/CdrContext';
import { inDateRange } from '../../utils/dateRange';
import { formatDurationCompact } from '../../utils/timeFormatter';
import MetricStrip from '../ui/MetricStrip';

// `dayScope` is the analytics view's per-shift filter: one shift picked in the
// dropdown above the charts, and the tiles have to describe that shift too.
export function deriveMetrics(analysis, dateRange, dayScope = '') {
  let totalCalls = 0,
    connected = 0,
    notConnected = 0,
    placed = 0,
    talkSec = 0,
    breakSec = 0,
    netActiveSec = 0,
    sessionSpanSec = 0,
    breaksCount = 0,
    longestBreakSec = 0;
  const perAgent = {};
  const regions = {};

  Object.entries(analysis).forEach(([ext, byDate]) => {
    Object.entries(byDate).forEach(([dateStr, data]) => {
      if (!inDateRange(dateStr, dateRange) || (dayScope && dateStr !== dayScope)) return;
      const agent = perAgent[ext] || (perAgent[ext] = { calls: 0, net: 0 });
      agent.calls += data.total_calls;
      agent.net += data.net_active_sec;
      Object.entries(data.region_counts || {}).forEach(([reg, n]) => {
        regions[reg] = (regions[reg] || 0) + n;
      });
      totalCalls += data.total_calls;
      connected += data.connected_calls;
      notConnected += data.not_connected_calls;
      placed += data.placed_calls;
      talkSec += data.total_talk_time_sec;
      breakSec += data.total_break_sec;
      netActiveSec += data.net_active_sec;
      sessionSpanSec += data.session_span_sec;
      breaksCount += data.breaks_count;
      (data.breaks_list || []).forEach((b) => {
        if (b.duration_seconds > longestBreakSec) longestBreakSec = b.duration_seconds;
      });
    });
  });

  const share = (part, whole) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '0%');
  const agents = Object.keys(perAgent).length;
  const rate = totalCalls > 0 ? ((connected / totalCalls) * 100).toFixed(1) : '0.0';
  const workedHours = netActiveSec / 3600;
  const perHour = workedHours > 0 ? (totalCalls / workedHours).toFixed(1) : '0.0';
  const bestHour = Object.values(perAgent).reduce(
    (max, a) => Math.max(max, a.net > 0 ? a.calls / (a.net / 3600) : 0),
    0
  );
  // Outbound CATI traffic means "0 in" would sit on the Calls card forever; the
  // region the team actually dialed is the second fact worth showing.
  const topRegion = Object.entries(regions).sort((a, b) => b[1] - a[1])[0];

  return {
    totalCalls,
    connected,
    notConnected,
    placed,
    rate,
    talkSec,
    breakSec,
    netActiveSec,
    breaksCount,
    agents,
    perHour,
    longestBreakSec,
    avgTalkSec: totalCalls > 0 ? talkSec / totalCalls : 0,
    bestHour: bestHour.toFixed(1),
    talkShare: share(talkSec, netActiveSec),
    spanShare: share(netActiveSec, sessionSpanSec),
    topRegion: topRegion ? `${topRegion[0]} ${topRegion[1]}` : '-',
    perAgentNet: agents > 0 ? netActiveSec / agents : 0
  };
}

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
