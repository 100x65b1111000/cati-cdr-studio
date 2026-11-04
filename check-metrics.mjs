// Checks the numbers behind the Analytics metric chips.
//   node check-metrics.mjs
import { deriveMetrics } from './src/services/metrics.js';
import { calculateShiftAnalysis, parseRawCallRecords, summariseRedials } from './src/services/shiftCalculator.js';
import { generateDemoCDRData } from './src/services/demoDataGenerator.js';
import { DEFAULT_EXT_MAP, DEFAULT_SHIFT_CONFIG } from './src/constants/defaultData.js';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

const raw = generateDemoCDRData(DEFAULT_EXT_MAP);
const analysis = calculateShiftAnalysis(parseRawCallRecords(raw), DEFAULT_EXT_MAP, DEFAULT_SHIFT_CONFIG, {});

const m = deriveMetrics(analysis, { preset: 'all', from: '', to: '' });
console.log('all-time:', JSON.stringify(m));

const numericOk = Object.entries(m).every(
  ([, v]) => (typeof v === 'number' ? Number.isFinite(v) : !/NaN|undefined|Infinity/.test(String(v)))
);
check('no NaN / undefined in any metric', numericOk);
check('placed ≤ total', m.placed <= m.totalCalls, `${m.placed} of ${m.totalCalls}`);
check('connected + missed = total', m.connected + m.notConnected === m.totalCalls);
check('top region resolved', /\S \d+$/.test(m.topRegion), m.topRegion);
check('talk fits inside net active', m.talkSec <= m.netActiveSec + 1, `${m.talkSec} vs ${m.netActiveSec}`);

const pct = (s) => parseInt(s, 10);
check('talk share within 0-100%', pct(m.talkShare) >= 0 && pct(m.talkShare) <= 100, m.talkShare);
check('span share within 0-100%', pct(m.spanShare) >= 0 && pct(m.spanShare) <= 100, m.spanShare);

const empty = deriveMetrics({}, { preset: 'all', from: '', to: '' });
check(
  'empty selection yields no NaN',
  Object.values(empty).every(
    (v) => (typeof v === 'number' ? Number.isFinite(v) : !/NaN|undefined|Infinity/.test(String(v)))
  ),
  JSON.stringify(empty)
);
check('empty selection reports 0%', empty.talkShare === '0%' && empty.spanShare === '0%');

const today = deriveMetrics(analysis, { preset: 'today', from: '', to: '' });
check('today range is a subset', today.totalCalls <= m.totalCalls, `${today.totalCalls} of ${m.totalCalls}`);

// The detail sheet's redial count, on a shift built so the answer is known: three calls
// to one number, two to another, one to a third. Three of those six are repeats.
const call = (dest, min, sec = 30, response = 'ANSWERED') => ({
  raw: { DESTINATION: dest },
  start_time: new Date(2026, 10, 4, 20, min, 0),
  duration: sec,
  response
});
const redials = summariseRedials([
  call('111', 0), call('222', 10), call('111', 20), call('333', 30), call('111', 40), call('222', 50, 12, 'BUSY')
]);
check('redials count the repeats, not the calls', redials.extra === 3 && redials.repeated === 2 && redials.numbers === 3, JSON.stringify(redials));
check('redial rows carry their own outcome', redials.top[0].dest === '111' && redials.top[0].calls === 3 && redials.top[1].answered === 1);
check('no repeats reads as no repeats', summariseRedials([call('999', 0)]).extra === 0);

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
