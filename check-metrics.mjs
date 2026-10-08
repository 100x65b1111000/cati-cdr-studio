// Checks the numbers behind the Analytics metric chips.
//   node check-metrics.mjs
// Runs through Vite's SSR loader so the app's extensionless imports resolve.
import { createServer } from 'vite';

const server = await createServer({ logLevel: 'silent', appType: 'custom' });
const load = (p) => server.ssrLoadModule(p);

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

try {
  const [
    { deriveMetrics },
    { calculateShiftAnalysis, parseRawCallRecords },
    { generateDemoCDRData },
    constants
  ] =
    await Promise.all([
      load('/src/components/dashboard/MetricsStrip.jsx'),
      load('/src/services/shiftCalculator.js'),
      load('/src/services/demoDataGenerator.js'),
      load('/src/constants/defaultData.js')
    ]);

  const raw = generateDemoCDRData(constants.DEFAULT_EXT_MAP);
  const analysis = calculateShiftAnalysis(
    parseRawCallRecords(raw),
    constants.DEFAULT_EXT_MAP,
    constants.DEFAULT_SHIFT_CONFIG,
    {}
  );

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
} finally {
  await server.close();
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
