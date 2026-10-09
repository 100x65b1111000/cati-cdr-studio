import React, { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { ChartBar, ChartDonut, ChartLine, Timer } from '@phosphor-icons/react';
import { useCdr } from '../../context/CdrContext';
import { DEFAULT_SHIFT_CONFIG } from '../../constants/defaultData';
import { themeColor, themeSeries } from '../../theme/colorSchemes';
import { createShiftDateResolver } from '../../services/shiftCalculator';
import { inDateRange, rangeDates } from '../../utils/dateRange';
import DayScopeSelect from '../ui/DayScopeSelect';
import EmptyState from '../ui/EmptyState';
import MetricsStrip from '../dashboard/MetricsStrip';

const D = DEFAULT_SHIFT_CONFIG;

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function Chart({ icon: Icon, title, note, empty, children }) {
  return (
    <section className="panel overflow-hidden rounded-2xl">
      <header className="flex items-center justify-between gap-3 border-b border-k-hairline px-5 py-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-k-ink">
          <Icon size={16} className="text-k-accent" />
          {title}
        </h3>
        <span className="num text-[11px] text-k-ink-muted">{note}</span>
      </header>
      <div className="h-72 p-5">
        {empty ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState title={empty} />
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

export default function AnalyticsView() {
  const { analysis, extNameMap, rawCalls, shiftConfig, dateRange, colorScheme } = useCdr();
  const [dayScope, setDayScope] = useState('');

  // Every chart here blends the shifts in range, which is exactly what you do not
  // want when one night went badly. The scope pulls all of them back to one shift.
  const shiftDays = useMemo(() => {
    const dateSet = new Set(rangeDates(dateRange, analysis));
    const counts = new Map();
    Object.values(analysis).forEach((byDate) => {
      Object.keys(byDate).forEach((dateStr) => {
        if (dateSet.has(dateStr)) counts.set(dateStr, (counts.get(dateStr) || 0) + 1);
      });
    });
    return Array.from(counts, ([date, agentDays]) => ({
      date,
      hint: `${agentDays} agent-days`
    })).sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [analysis, dateRange]);

  const scope = shiftDays.some((d) => d.date === dayScope) ? dayScope : '';

  const { volumeData, regionalData, timeData, hourlyData, options, scales, agentDays, regions, hours } =
    useMemo(() => {
      const ink = themeColor('ink');
      const inkMuted = themeColor('ink-muted');
      const hairline = themeColor('hairline');
      const surface = themeColor('surface');
      const series = themeSeries();
      const [accent, talk, throughput, breakTime, success] = series;

      const resolveShiftDate = createShiftDateResolver(shiftConfig);
      const dateSet = new Set(rangeDates(dateRange, analysis));

      const labels = [];
      const callCounts = [];
      const connectedCounts = [];
      const talkMins = [];
      const breakMins = [];
      const regionTotals = {};

      Object.keys(analysis)
        .sort()
        .forEach((ext) => {
          const name = extNameMap[ext] || ext;
          Object.keys(analysis[ext]).forEach((dateStr) => {
            if (!inDateRange(dateStr, dateRange, dateSet) || (scope && dateStr !== scope)) return;
            const data = analysis[ext][dateStr];
            labels.push(`${name} ${dateStr.slice(5)} (${ext})`);
            callCounts.push(data.total_calls);
            connectedCounts.push(data.connected_calls);
            talkMins.push(parseFloat((data.total_talk_time_sec / 60).toFixed(1)));
            breakMins.push(parseFloat((data.total_break_sec / 60).toFixed(1)));
            Object.entries(data.region_counts || {}).forEach(([reg, count]) => {
              regionTotals[reg] = (regionTotals[reg] || 0) + count;
            });
          });
        });

      const callsInRange = rawCalls.filter((c) => {
        const day = resolveShiftDate(c.start_time);
        return inDateRange(day, dateRange, dateSet) && (!scope || day === scope);
      });

      const startHour = parseInt((shiftConfig.shiftStartTime || D.shiftStartTime).split(':')[0], 10) || 20;
      const endHour = parseInt((shiftConfig.shiftEndTime || D.shiftEndTime).split(':')[0], 10) || 5;
      // `??` not `||`: a same-day shift stores endDay 0, which `||` would erase to 1
      const startDay = shiftConfig.shiftStartDay ?? D.shiftStartDay;
      const endDay = shiftConfig.shiftEndDay ?? D.shiftEndDay;

      let shiftDuration = endDay * 24 + endHour - (startDay * 24 + startHour);
      if (shiftDuration <= 0) shiftDuration += 24;

      let earliestCallHour = startHour;
      let maxRelativeHour = shiftDuration;
      let minCallMs = null;

      if (callsInRange.length > 0) {
        let minCallTime = callsInRange[0].start_time;
        let maxCallTime = callsInRange[0].start_time;
        callsInRange.forEach((c) => {
          if (c.start_time < minCallTime) minCallTime = c.start_time;
          if (c.start_time > maxCallTime) maxCallTime = c.start_time;
        });
        earliestCallHour = minCallTime.getHours();
        minCallMs = minCallTime.getTime();
        const callSpanHours = Math.ceil((maxCallTime.getTime() - minCallMs) / 3600000);
        let shiftEndFromEarliest = endDay * 24 + endHour - (startDay * 24 + earliestCallHour);
        if (shiftEndFromEarliest <= 0) shiftEndFromEarliest += 24;
        maxRelativeHour = Math.max(shiftDuration, callSpanHours, shiftEndFromEarliest);
      }

      const hourlyLabels = [];
      const hourlyIntensity = [];
      for (let i = 0; i <= maxRelativeHour; i++) {
        hourlyLabels.push(`${String((earliestCallHour + i) % 24).padStart(2, '0')}:00`);
        hourlyIntensity.push(0);
      }
      if (minCallMs !== null) {
        callsInRange.forEach((c) => {
          const relIdx = Math.floor((c.start_time.getTime() - minCallMs) / 3600000);
          if (relIdx >= 0 && relIdx <= maxRelativeHour) hourlyIntensity[relIdx] += 1;
        });
      }

      const regionLabels = Object.keys(regionTotals);

      return {
        agentDays: labels.length,
        regions: regionLabels.length,
        hours: callsInRange.length,
        scales: {
          x: { ticks: { color: inkMuted }, grid: { color: hairline } },
          y: { ticks: { color: inkMuted }, grid: { color: hairline } }
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: { legend: { labels: { color: ink, boxWidth: 10, boxHeight: 10 } } }
        },
        volumeData: {
          labels,
          datasets: [
            { label: 'Total calls', data: callCounts, backgroundColor: accent, borderRadius: 6 },
            { label: 'Connected', data: connectedCounts, backgroundColor: success, borderRadius: 6 }
          ]
        },
        regionalData: {
          labels: regionLabels,
          datasets: [
            {
              data: regionLabels.map((r) => regionTotals[r]),
              backgroundColor: series,
              borderColor: surface,
              borderWidth: 2
            }
          ]
        },
        timeData: {
          labels,
          datasets: [
            { label: 'Talk (min)', data: talkMins, backgroundColor: talk, borderRadius: 6 },
            { label: 'Break (min)', data: breakMins, backgroundColor: breakTime, borderRadius: 6 }
          ]
        },
        hourlyData: {
          labels: hourlyLabels,
          datasets: [
            {
              label: 'Calls in the hour',
              data: hourlyIntensity,
              borderColor: throughput,
              backgroundColor: themeColor('throughput', 0.15),
              fill: true,
              tension: 0.3,
              pointRadius: 2
            }
          ]
        }
      };
    }, [analysis, extNameMap, rawCalls, shiftConfig, dateRange, colorScheme, scope]);

  if (agentDays === 0) {
    return (
      <div className="panel rounded-2xl">
        <EmptyState
          title="Nothing to chart"
          body="Load the sample data or drop a CDR CSV, then widen the date range above."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DayScopeSelect days={shiftDays} value={scope} onChange={setDayScope} />

      <MetricsStrip dayScope={scope} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Chart icon={ChartBar} title="Calls per agent-day" note={`${agentDays} agent-days`}>
          <Bar data={volumeData} options={{ ...options, scales }} />
        </Chart>

        <Chart
          icon={ChartDonut}
          title="Calls by region"
          note={regions > 0 ? `${regions} ${regions === 1 ? 'region' : 'regions'}` : 'no region column'}
          empty={regions === 0 ? 'No region recorded' : null}
        >
          <Doughnut
            data={regionalData}
            options={{ ...options, plugins: { legend: { position: 'right', labels: { color: themeColor('ink') } } } }}
          />
        </Chart>

        <Chart icon={Timer} title="Talk against break" note="minutes">
          <Bar data={timeData} options={{ ...options, scales }} />
        </Chart>

        <Chart icon={ChartLine} title="Call intensity by hour" note={hours > 0 ? `${hours} calls` : 'no calls'} empty={hours === 0 ? 'No calls in this date range' : null}>
          <Line data={hourlyData} options={{ ...options, scales }} />
        </Chart>
      </div>
    </div>
  );
}
