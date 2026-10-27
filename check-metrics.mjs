// Checks the numbers behind the Analytics metric chips.
//   node check-metrics.mjs
import { deriveMetrics } from './src/services/metrics.js';
import { calculateShiftAnalysis, parseRawCallRecords } from './src/services/shiftCalculator.js';
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

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
