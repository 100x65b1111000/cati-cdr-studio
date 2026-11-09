import React, { useMemo, useState } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { useCdr } from '../../context/CdrContext';
import { DEFAULT_SHIFT_CONFIG } from '../../constants/defaultData';
import { themeColor, themeSeries } from '../../theme/colorSchemes';
import { createShiftDateResolver } from '../../services/shiftCalculator';
import { inDateRange, rangeDates } from '../../utils/dateRange';
import Chart from '../ui/Chart';
import DayScopeSelect from '../ui/DayScopeSelect';
import EmptyState from '../ui/EmptyState';
import MetricsStrip from '../dashboard/MetricsStrip';

const D = DEFAULT_SHIFT_CONFIG;

export default function AnalyticsView() {
  const { analysis, extNameMap, rawCalls, shiftConfig, dateRange, colorScheme, slide, isParsing } = useCdr();
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

  const { volumeData, regionalData, timeData, hourlyData, dayRows,
    volumeOptions, regionOptions, hourlyOptions, timeOptions, agentDays, regions, hours } =
    useMemo(() => {
      const ink = themeColor(colorScheme, 'ink');
      const inkMuted = themeColor(colorScheme, 'ink-muted');
      const hairline = themeColor(colorScheme, 'hairline');
      const surface = themeColor(colorScheme, 'surface');
      const series = themeSeries(colorScheme);
      const [accent, talk, throughput, breakTime, success] = series;

      const resolveShiftDate = createShiftDateResolver(shiftConfig);
      const dateSet = new Set(rangeDates(dateRange, analysis));

      const labels = [];
      const callCounts = [];
      const connectedCounts = [];
      const talkMins = [];
      const breakMins = [];
      const regionTotals = {};
      const dayTotals = {};

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
            const day = dayTotals[dateStr] || (dayTotals[dateStr] = { calls: 0, netSec: 0, agents: 0 });
            day.calls += data.total_calls;
            day.netSec += data.net_active_sec;
            day.agents += 1;
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

      const scales = () => ({
        x: { ticks: { color: inkMuted }, grid: { color: themeColor(colorScheme, 'hairline', 0.4) } },
        y: { ticks: { color: inkMuted }, grid: { color: themeColor(colorScheme, 'hairline', 0.4) } }
      });
      const stacked = () => {
        const s = scales();
        s.x.stacked = true;
        s.y.stacked = true;
        return s;
      };
      const options = {
        responsive: true,
        maintainAspectRatio: false,
        // No entry ramp, and not by taste: the responsive observer re-measures a chart a few
        // frames after it is built and chart.js answers with an unanimated update, so three of
        // these four would snap to their data regardless. 0 makes them agree. The hover still
        // ramps, through `transitions.active`.
        animation: { duration: 0 },
        plugins: { legend: { labels: { color: ink, boxWidth: 10, boxHeight: 10 } } }
      };
      // One options object and one scales object per chart, built with the data: react-chartjs-2
      // re-updates a chart whenever either identity changes, and a spread written inline in the
      // JSX changes it on every render.

      return {
        agentDays: labels.length,
        regions: regionLabels.length,
        hours: callsInRange.length,
        dayRows: Object.entries(dayTotals)
          .map(([date, v]) => ({ date, ...v }))
          .sort((a, b) => (a.date < b.date ? -1 : 1)),
        volumeOptions: { ...options, scales: scales() },
        hourlyOptions: { ...options, scales: scales() },
        regionOptions: { ...options, plugins: { legend: { position: 'right', labels: { color: ink } } } },
        timeOptions: { ...options, scales: stacked() },
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
              backgroundColor: themeColor(colorScheme, 'throughput', 0.15),
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
      <div className="panel rounded">
        <EmptyState
          title="Nothing to chart"
          body="Upload a CDR CSV from the sidebar, then widen the date range above."
        />
      </div>
    );
  }

  // The rhythm plate is a bar chart of bars: every row is scaled against the busiest
  // shift in range, so the reader compares nights without reading numbers off a grid.
  const maxCalls = Math.max(...dayRows.map((d) => d.calls), 1);

  return (
    <div className={`animate__animated ${slide} space-y-3`}>
      <DayScopeSelect days={shiftDays} value={scope} onChange={setDayScope} />

      <MetricsStrip dayScope={scope} />

      {/* One grid, three weights. The volume chart leads at two thirds and the region
          split rides beside it; the hour line and the shift rhythm take the second row;
          the talk-against-break stack runs the full width because it is the one chart
          read across every agent-day at once. Four equal boxes in two equal rows was
          the composition the app shipped with, and it said nothing about which of
          these to look at first. */}
      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-3">
        <Chart
          className="xl:col-span-2"
          title="Calls per agent-day"
          note={`${agentDays} agent-days`}
          body="h-64 sm:h-80"
          loading={isParsing}
        >
          <Bar data={volumeData} options={volumeOptions} />
        </Chart>

        <Chart
          title="Calls by region"
          note={regions > 0 ? `${regions} ${regions === 1 ? 'region' : 'regions'}` : 'no region column'}
          empty={regions === 0 ? 'No region recorded' : null}
          body="h-64 sm:h-80"
          loading={isParsing}
        >
          <Doughnut data={regionalData} options={regionOptions} />
        </Chart>

        <Chart
          className="xl:col-span-2"
          title="Call intensity by hour"
          note={hours > 0 ? `${hours} calls` : 'no calls'}
          empty={hours === 0 ? 'No calls in this date range' : null}
          body="h-56 sm:h-64"
          loading={isParsing}
        >
          <Line data={hourlyData} options={hourlyOptions} />
        </Chart>

        <section className="panel overflow-hidden rounded">
          <header className="flex items-baseline justify-between gap-3 border-b border-k-hairline bg-k-sunken px-3.5 py-2.5">
            <h3 className="text-xs font-semibold text-k-ink">Shift by shift</h3>
            <span className="num text-2xs text-k-ink-muted">{dayRows.length} in range</span>
          </header>
          <ul className="divide-y divide-k-hairline/60">
            {dayRows.map((d) => (
              <li key={d.date} className="row-hover flex flex-col gap-1.5 px-3.5 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="num text-xs text-k-ink">{d.date}</span>
                  <span className="num text-sm font-semibold leading-none text-k-ink">{d.calls}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded bg-k-sunken ring-1 ring-inset ring-k-hairline">
                  <div
                    className="h-full rounded bg-k-accent-fg/70"
                    style={{ width: `${Math.max(2, Math.round((d.calls / maxCalls) * 100))}%` }}
                  />
                </div>
                <span className="text-2xs text-k-ink-muted">
                  {d.agents} on shift, {Math.round(d.netSec / 60)} min net
                </span>
              </li>
            ))}
          </ul>
        </section>

        <Chart
          className="xl:col-span-3"
          title="Talk against break"
          note="minutes, stacked over the session"
          body="h-56 sm:h-64"
          loading={isParsing}
        >
          <Bar data={timeData} options={timeOptions} />
        </Chart>
      </div>
    </div>
  );
}
