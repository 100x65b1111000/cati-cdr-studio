import { formatDuration, formatTimeOnly } from '../utils/timeFormatter.js';

function formatShiftDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Precomputes the shift window anchor once so each call resolves its logical
// shift date arithmetically instead of probing day offsets with Date objects.
export function createShiftDateResolver(config) {
  const [startHH, startMM] = (config.shiftStartTime || "20:00").split(':').map(Number);
  const startSecInDay = startHH * 3600 + (startMM || 0) * 60;
  const shiftStartDay = config.shiftStartDay || 0;

  // Malformed shift time never matches a window; fall back to the calendar date.
  if (!Number.isFinite(startSecInDay)) {
    return (callStart) => formatShiftDate(callStart);
  }

  const base = shiftStartDay * 86400 + startSecInDay;
  const qb = Math.floor(base / 86400);
  const rb = base - qb * 86400;

  return (callStart) => {
    const y = callStart.getFullYear();
    const m = callStart.getMonth();
    const d = callStart.getDate();
    const t = (callStart.getTime() - new Date(y, m, d).getTime()) / 1000;
    const k = t >= rb ? -qb : -qb - 1;
    // Windows only exist for day offsets -2..2 (inherited from the original probe range).
    if (k < -2 || k > 2) return formatShiftDate(callStart);
    return formatShiftDate(new Date(y, m, d + k));
  };
}

export function parseRawCallRecords(rawRecords) {
  const calls = [];
  rawRecords.forEach((row) => {
    let ext = (row['EXTENSION'] || row['Extension'] || row['ext'] || '').toString().trim().replace(/"/g, '');
    if (!ext) return;

    let startStr = (row['CALL DATE (UTC)'] || row['CALL DATE (Asia/Kolkata)'] || row['CALL DATE'] || row['Call Date'] || '').toString().trim();
    if (!startStr) return;

    let endStr = (row['END TIME (UTC)'] || row['END TIME (Asia/Kolkata)'] || row['END TIME'] || row['End Time'] || '').toString().trim();
    let durationSec = parseInt(row['DURATION'] || row['Duration'] || 0, 10) || 0;

    let startDt = new Date(startStr.replace(' ', 'T'));
    if (isNaN(startDt.getTime())) startDt = new Date(startStr);
    if (isNaN(startDt.getTime())) return;

    let endDt = endStr ? new Date(endStr.replace(' ', 'T')) : null;
    if (!endDt || isNaN(endDt.getTime())) {
      endDt = new Date(startDt.getTime() + durationSec * 1000);
    }

    let direction = (row['DIRECTION'] || row['Direction'] || 'OUT').toString().trim().toUpperCase();
    let response = (row['RESPONSE'] || row['Response'] || 'ANSWERED').toString().trim().toUpperCase();
    let region = (row['REGION'] || row['Region'] || 'Unknown').toString().trim().replace(/"/g, '') || 'Unknown';

    calls.push({
      extension: ext,
      start_time: startDt,
      end_time: endDt,
      duration: durationSec,
      direction: direction,
      response: response,
      region: region,
      raw: row
    });
  });

  return calls;
}

// A redial is one destination number reached more than inside a single agent's shift.
// Nothing else in the pipeline counts numbers — the rundown counts calls — so this reads
// the raw row for the number, the same way the Raw CDR table does.
export function summariseRedials(calls) {
  const byNumber = new Map();
  calls.forEach((c) => {
    const dest = c.raw?.DESTINATION || c.raw?.CLID || '';
    if (!dest) return;
    const e = byNumber.get(dest) || { dest, calls: 0, answered: 0, sec: 0, last: c.start_time };
    e.calls += 1;
    if (c.response === 'ANSWERED') e.answered += 1;
    e.sec += c.duration;
    if (c.start_time > e.last) e.last = c.start_time;
    byNumber.set(dest, e);
  });
  const repeated = [...byNumber.values()].filter((e) => e.calls > 1).sort((a, b) => b.calls - a.calls);
  return {
    numbers: byNumber.size,
    repeated: repeated.length,
    extra: repeated.reduce((sum, e) => sum + e.calls - 1, 0),
    top: repeated.slice(0, 8)
  };
}

export function calculateShiftAnalysis(calls, extNameMap, config, manualOverrides = {}) {
  const thresholdSecs = (config.breakThresholdMinutes || 10) * 60;
  const getShiftDate = createShiftDateResolver(config);

  const agentData = {};
  calls.forEach(call => {
    const ext = call.extension;
    const callStart = call.start_time;

    const dateStr = getShiftDate(callStart);

    if (!agentData[ext]) agentData[ext] = {};
    if (!agentData[ext][dateStr]) agentData[ext][dateStr] = [];
    agentData[ext][dateStr].push(call);
  });

  const analysis = {};

  Object.keys(agentData).forEach(ext => {
    analysis[ext] = {};

    Object.keys(agentData[ext]).forEach(dateStr => {
      const dayCalls = agentData[ext][dateStr];
      dayCalls.sort((a, b) => a.start_time - b.start_time);

      const totalCalls = dayCalls.length;
      const placedCalls = dayCalls.filter(c => c.direction === 'OUT').length;
      const receivedCalls = dayCalls.filter(c => c.direction === 'IN').length;
      const connectedCalls = dayCalls.filter(c => c.response === 'ANSWERED').length;
      const notConnectedCalls = totalCalls - connectedCalls;

      const regionCounts = {};
      dayCalls.forEach(c => {
        const reg = c.region || 'Unknown';
        regionCounts[reg] = (regionCounts[reg] || 0) + 1;
      });

      const regionSummary = Object.entries(regionCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([reg, count]) => `${reg}: ${count}`)
        .join(', ') || '-';

      const firstCallTime = dayCalls[0].start_time;
      const lastCallTime = dayCalls[dayCalls.length - 1].start_time;
      const totalTalkSeconds = dayCalls.reduce((sum, c) => sum + c.duration, 0);

      let overallEndTime = dayCalls[0].end_time;
      dayCalls.forEach(c => {
        if (c.end_time > overallEndTime) overallEndTime = c.end_time;
      });

      const breaks = [];
      let currentMaxEnd = dayCalls[0].end_time;

      if (dayCalls.length > 1) {
        for (let i = 1; i < dayCalls.length; i++) {
          const nextCall = dayCalls[i];
          const nextStart = nextCall.start_time;

          if (nextStart > currentMaxEnd) {
            const gapSec = (nextStart - currentMaxEnd) / 1000;
            if (gapSec > thresholdSecs) {
              breaks.push({
                start: formatTimeOnly(currentMaxEnd),
                end: formatTimeOnly(nextStart),
                duration_seconds: Math.floor(gapSec),
                duration_formatted: formatDuration(gapSec)
              });
            }
          }

          if (nextCall.end_time > currentMaxEnd) {
            currentMaxEnd = nextCall.end_time;
          }
        }
      }

      const spanStart = firstCallTime;
      const spanEnd = overallEndTime > lastCallTime ? overallEndTime : lastCallTime;
      const totalSessionSeconds = Math.max(0, (spanEnd - spanStart) / 1000);
      const totalBreakSeconds = breaks.reduce((sum, b) => sum + b.duration_seconds, 0);
      const netActiveSeconds = Math.max(0, totalSessionSeconds - totalBreakSeconds);

      const netActiveHours = netActiveSeconds > 0 ? netActiveSeconds / 3600 : 0;
      const callsPerHour = netActiveHours > 0 ? (totalCalls / netActiveHours).toFixed(1) : "0.0";

      const key = `${ext}_${dateStr}`;
      const manual = manualOverrides[key] || { halfDones: 0, surveys: 0 };

      analysis[ext][dateStr] = {
        extension: ext,
        date: dateStr,
        name: extNameMap[ext] || '-',
        total_calls: totalCalls,
        region_counts: regionCounts,
        region_summary: regionSummary,
        placed_calls: placedCalls,
        received_calls: receivedCalls,
        connected_calls: connectedCalls,
        not_connected_calls: notConnectedCalls,
        first_call: formatTimeOnly(firstCallTime),
        last_call: formatTimeOnly(lastCallTime),
        total_talk_time_sec: totalTalkSeconds,
        total_talk_time_formatted: formatDuration(totalTalkSeconds),
        // Wall clock from first call to last activity; net_active is this minus breaks.
        session_span_sec: Math.floor(totalSessionSeconds),
        session_span_formatted: formatDuration(totalSessionSeconds),
        total_break_sec: totalBreakSeconds,
        total_break_formatted: formatDuration(totalBreakSeconds),
        net_active_sec: Math.floor(netActiveSeconds),
        net_active_formatted: formatDuration(netActiveSeconds),
        calls_per_hour: callsPerHour,
        half_dones: manual.halfDones || 0,
        surveys: manual.surveys || 0,
        breaks_count: breaks.length,
        breaks_list: breaks
      };
    });
  });

  return analysis;
}
