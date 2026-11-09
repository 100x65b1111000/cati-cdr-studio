import { DEMO_REGIONS } from '../constants/defaultData.js';

// Fictional randomized area codes for simulated telephony data
const RANDOM_AREA_CODES = ['206', '212', '303', '312', '404', '415', '503', '512', '602', '617', '702', '713', '801', '818', '919'];

function randomPhoneNumber() {
  const area = RANDOM_AREA_CODES[Math.floor(Math.random() * RANDOM_AREA_CODES.length)];
  const exchange = Math.floor(200 + Math.random() * 800);
  const subscriber = String(Math.floor(1000 + Math.random() * 9000));
  return `1${area}${exchange}${subscriber}`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function makeTimestampFromSeconds(baseDate, totalSecsFromMidnight) {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0, 0);
  d.setSeconds(totalSecsFromMidnight);
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

/**
 * Generates an end-to-end simulated CATI CDR dataset covering every real-world operational
 * edge case the platform supports:
 *
 * 1. Multi-shift history: Today (Shift 0, all agents), Yesterday (Shift -1), and 2-Days-Ago (Shift -2),
 *    allowing date presets ('today', 'yesterday', 'last7', 'all') and DayScope dropdowns to function vividly.
 * 2. Overnight rollover: Shifts run from 20:00 to 05:00 next morning, crossing midnight cleanly into one logical shift.
 * 3. Directionality: Mostly outbound ('OUT'), with realistic inbound return calls ('IN').
 * 4. Varied outcomes: 'ANSWERED' (with durations), 'NO ANSWER', 'BUSY', 'REJECTED', and carrier 'FAILED' (0s duration).
 * 5. Break threshold dynamics: Normal dialing gaps (1-3 min), borderline under-threshold gaps (8.5 min),
 *    short comfort breaks (12-15 min), and meal breaks (30-45 min).
 * 6. Agent archetypes & extremes:
 *    - Top performer (high volume, 80%+ answer rate, 3h+ talk time)
 *    - Marathon surveyor (deep 10-25 min interviews)
 *    - Cold-caller (high dial count, low 28% connect rate, heavy busy/no-answer)
 *    - Inbound specialist (high ratio of IN calls)
 *    - Heavy redialler (multiple repeated calls to identical destinations)
 *    - Single-call edge case (agent placing exactly 1 call)
 *    - Continuous dialing runner (zero breaks across entire shift)
 *    - Multi-break agent (3 distinct breaks across the night)
 * 7. Redials: Destination pool reuse powering the redial count, answer rate, and repeat distribution in agent details.
 * 8. Full regional diversity across all configured DEMO_REGIONS.
 */
export function generateDemoCDRData(extNameMap) {
  const TODAY = new Date();
  const dayDate = (offset) => new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + offset);
  const demoCalls = [];
  const exts = Object.keys(extNameMap);
  const regions = DEMO_REGIONS;

  const SHIFTS = [
    { offset: 0, agentCount: exts.length },
    { offset: -1, agentCount: Math.min(16, exts.length) },
    { offset: -2, agentCount: Math.min(12, exts.length) }
  ];

  SHIFTS.forEach(({ offset, agentCount }) => {
    const baseDate = dayDate(offset);
    const activeExts = exts.slice(0, agentCount);

    activeExts.forEach((ext, idx) => {
      let callCount = 22;
      let answerRate = 0.65;
      let avgDuration = 140;
      let longSurveys = false;
      let isSingleCall = false;
      let zeroBreaks = false;
      let multiBreaks = false;
      let borderlineGap = false;
      let highRedials = false;
      let inboundRatio = 0.05;

      if (idx === 0) {
        // High performer
        callCount = 34;
        answerRate = 0.82;
        avgDuration = 180;
      } else if (idx === 2) {
        // Marathon surveyor
        callCount = 12;
        answerRate = 0.85;
        avgDuration = 800;
        longSurveys = true;
      } else if (idx === 3) {
        // High dial, low connection
        callCount = 42;
        answerRate = 0.28;
        avgDuration = 60;
      } else if (idx === 4) {
        // Inbound specialist
        callCount = 24;
        inboundRatio = 0.35;
      } else if (idx === 5) {
        // High redials
        callCount = 28;
        highRedials = true;
      } else if (idx === 6 && offset === 0) {
        // Single call edge case (today)
        callCount = 1;
        isSingleCall = true;
      } else if (idx === 7) {
        // Zero breaks continuous runner
        zeroBreaks = true;
        callCount = 24;
      } else if (idx === 8) {
        // Multi-break
        multiBreaks = true;
        callCount = 22;
      } else if (idx === 9) {
        // Borderline gap (8.5 min gap, strictly < 10 min threshold)
        borderlineGap = true;
        callCount = 20;
      }

      // Pre-seed redial destination pool for realistic call recurrence
      const poolSize = highRedials ? 6 : Math.max(4, Math.floor(callCount * 0.6));
      const destPool = Array.from({ length: poolSize }, () => randomPhoneNumber());

      // Start shift around 20:05 - 20:30 (72300 - 73800 seconds from midnight)
      let currentSec = 20 * 3600 + 5 * 60 + (idx * 90);

      for (let i = 0; i < callCount; i++) {
        const isAnswered = isSingleCall || Math.random() < answerRate;
        let durationSec = 0;
        if (isAnswered) {
          if (longSurveys) {
            durationSec = Math.floor(600 + Math.random() * 900); // 10-25 min
          } else {
            durationSec = Math.floor(30 + Math.random() * (avgDuration * 1.5));
          }
        }

        let response = 'ANSWERED';
        if (!isAnswered) {
          const r = Math.random();
          response = r < 0.6 ? 'NO ANSWER' : r < 0.85 ? 'BUSY' : r < 0.95 ? 'REJECTED' : 'FAILED';
        }

        const direction = Math.random() < inboundRatio ? 'IN' : 'OUT';
        const region = regions[Math.floor(Math.random() * regions.length)];

        // Select destination: high redials agents reuse numbers frequently
        const destination = Math.random() < (highRedials ? 0.6 : 0.25)
          ? destPool[Math.floor(Math.random() * destPool.length)]
          : randomPhoneNumber();
        const clid = randomPhoneNumber();

        const startStr = makeTimestampFromSeconds(baseDate, currentSec);
        const endStr = makeTimestampFromSeconds(baseDate, currentSec + durationSec);

        demoCalls.push({
          'CALL DATE (UTC)': startStr,
          'END TIME (UTC)': endStr,
          'EXTENSION': ext,
          'DIRECTION': direction,
          'RESPONSE': response,
          'DURATION': String(durationSec),
          'REGION': region,
          'CLID': clid,
          'DESTINATION': destination
        });

        // Determine inter-call pacing and break gaps
        let gapSec = Math.floor(45 + Math.random() * 150); // standard 45s - 3m dial gap
        if (zeroBreaks) {
          gapSec = Math.floor(30 + Math.random() * 180); // strictly <= 3.5 min, no breaks
        } else if (borderlineGap && i === 5) {
          gapSec = 520; // 8m 40s (under 10m threshold, active dial time)
        } else if (multiBreaks) {
          if (i === 4) gapSec = 780; // 13m short comfort break
          else if (i === 11) gapSec = 2100; // 35m dinner break
          else if (i === 17) gapSec = 900; // 15m wrap-up break
        } else if (i === Math.floor(callCount / 2)) {
          gapSec = Math.floor(1800 + Math.random() * 900); // 30-45m dinner break
        }

        currentSec += durationSec + gapSec;
      }
    });
  });

  return demoCalls;
}
