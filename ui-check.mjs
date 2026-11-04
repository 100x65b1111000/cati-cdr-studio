// Layering + overflow sweep for every view. The app is behind the team password, so this
// signs in with APP_PASSWORD from .env.local, and it uploads fixtures, so run it against a
// scratch database:
//   DB_PATH=data/test.sqlite npm run dev      # then:
//   node ui-check.mjs
// Screenshots land in _ui/. Exit 1 when something is buried, clipped or throwing.
import { chromium } from 'playwright';
import Papa from 'papaparse';
import { mkdirSync, readFileSync } from 'node:fs';
import { COLOR_MODES, SERIES_ROLES, DEFAULT_MODE, cssVarName, hexToRgbTriplet } from './src/theme/colorSchemes.js';
import { pickRange } from './src/utils/dateRange.js';
import { SESSION_COOKIE } from './src/lib/auth.js';

const BASE = process.env.UI_URL || 'http://localhost:3000';
const OUT = '_ui';
const VIEWPORT = { width: 1440, height: 950 };
mkdirSync(OUT, { recursive: true });

// Everything below runs against the gated app, so the harness signs in through the same
// endpoint a person uses and hands each browser context the cookie that comes back. Mints
// once and reuses it: the second context is the multi-day scenario at checkDays.
let session;
async function signIn(context) {
  if (!session) {
    try {
      process.loadEnvFile('.env.local');
    } catch {
      // No local env file; rely on APP_PASSWORD from the shell.
    }
    if (!process.env.APP_PASSWORD) {
      throw new Error('ui-check: APP_PASSWORD is not set, so nothing can get past the sign-in gate.');
    }
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ password: process.env.APP_PASSWORD }),
      redirect: 'manual'
    });
    const value = res.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
      ?.split('=').slice(1).join('=');
    if (!value) {
      throw new Error(`ui-check: sign-in at ${BASE} was rejected — APP_PASSWORD must match the server's .env.local.`);
    }
    session = { name: SESSION_COOKIE, value, url: BASE };
  }
  await context.addCookies([session]);
}

const VIEWS = [
  ['1', 'rundown'],
  ['2', 'rawCdr'],
  ['3', 'analytics'],
  ['4', 'directory'],
  ['5', 'settings']
];

// The two views that render a report table, so a check that walks cells or headers does
// not re-spell the pair.
const TABLE_VIEWS = VIEWS.slice(0, 2);

const failures = [];

// The sample file has one date, so the two-click range can't be exercised through
// the UI. Assert it on the pure helper instead.
for (const [[from, to, iso], want] of [
  [['', '', '2026-10-05'], ['2026-10-05', '']],
  [['2026-10-05', '', '2026-10-09'], ['2026-10-05', '2026-10-09']],
  [['2026-10-05', '', '2026-10-02'], ['2026-10-02', '2026-10-05']],
  [['2026-10-05', '2026-10-09', '2026-10-11'], ['2026-10-11', '']],
  [['2026-10-05', '2026-10-09', '2026-10-07'], ['2026-10-07', '']]
]) {
  const got = pickRange(from, to, iso);
  if (got[0] !== want[0] || got[1] !== want[1]) {
    failures.push(`pickRange(${from}, ${to}, ${iso}) -> ${got.join(', ')}, expected ${want.join(', ')}`);
  }
}

// Windows can hold a recently-viewed PNG open for a moment, which fails the write.
async function shot(page, path, opts) {
  try {
    await page.screenshot({ path, ...opts });
  } catch {
    await page.waitForTimeout(600);
    await page.screenshot({ path, ...opts });
  }
}

// Every view switch, dialog dismissal and stepper nudge is a key press followed by a
// settle wait; 44 sites wrote both lines. A switch is not the key plus the ramp: the route
// has to change, the lazy view has to mount, and only then does the 450ms sweep start — so
// the page was still moving when a fixed wait expired, and the geometry below measured a
// page in flight. The floor lets the commit happen; the wait is the app finishing.
const press = (key, ms = 500, pg = page) =>
  pg
    .keyboard.press(key)
    .then(() => pg.waitForTimeout(ms))
    .then(() =>
      pg.waitForFunction(
        () =>
          [...document.querySelectorAll('main .animate__animated')].every((el) =>
            el.getAnimations().every((a) => a.playState !== 'running')
          ),
        null,
        { timeout: 8000 }
      )
    );

const browser = await chromium.launch();
// Pin the emulated preference, or the app boots into whichever mode Playwright's
// default happens to match and every measurement below silently changes meaning.
// The mode loop inside checkChrome paints the other palette on the same page.
const page = await browser.newPage({ viewport: VIEWPORT, colorScheme: DEFAULT_MODE });
await signIn(page.context());

// Tailwind v4 mixes an alpha variant of a colour into oklab while the solid token
// computes to plain rgb, so the computed strings are not comparable. Paint each value
// into a 1px buffer and read the sRGB channels back — un-premultiplied, so the hue
// survives the tint and the fourth channel is its alpha.
// One pass is the faithful read, for the checks that compare alpha as well as colour.
// `opaque: true` re-paints the swatch over itself until alpha reaches 1, for the checks
// that only ask "is this the same hue": an 8-bit buffer loses two to seven channels at
// the alphas a subtle edge uses, which is measurement noise and not a colour, while a
// genuinely different hue (blue against violet) stays ~100 apart however many passes.
const paint = (vals, { opaque = false } = {}) =>
  page.evaluate((arg) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 1;
    const g = cv.getContext('2d', { willReadFrequently: true });
    return arg.list.map((v) => {
      g.fillStyle = v;
      for (let i = 0; i < arg.passes; i++) {
        g.globalCompositeOperation = i ? 'source-over' : 'copy';
        g.fillRect(0, 0, 1, 1);
      }
      return [...g.getImageData(0, 0, 1, 1).data];
    });
  }, { list: vals, passes: opaque ? 8 : 1 });
const chans = (vals) => paint(vals, { opaque: true }).then((list) => list.map((c) => c.slice(0, 3)));
const near = (a, b, tol = 3) => a.every((n, i) => Math.abs(n - b[i]) <= tol);
const rgb = (a) => `rgb(${a.join(' ')})`;
// The sync twin of chans(): three channels out of a computed rgb()/oklab() string, for
// the comparisons that do not need a composite. 4 checks wrote their own extractor.
const chan = (s) => ((s || '').match(/[\d.]+/g) || []).slice(0, 3).map(Number);
// Two computed colour strings, close enough to be the same hue. The sites that only have
// strings (never a composite to flatten) and a tolerance of their own.
const rgbNear = (a, b, tol = 2) => near(chan(a), chan(b), tol);

// A box padded and clamped to the viewport: the clip a screenshot of one control wants.
// Two checks spelled the arithmetic out longhand.
const clip = (b, pad = 24) => {
  const x = Math.max(0, b.x - pad);
  const y = Math.max(0, b.y - pad);
  return { x, y, width: Math.min(b.width + 2 * pad, VIEWPORT.width - x - 1), height: Math.min(b.height + 2 * pad, VIEWPORT.height - y - 1) };
};

// Click a trigger and hand back the menu it owns. The menu is a child of the trigger's
// own wrapper (which is what declares `--tone`), so a global `.menu` read picks up
// whatever panel a previous check left open instead of the one just probed.
const openMenu = async (trigger, ms = 260, pg = page) => {
  await trigger.click();
  await pg.waitForTimeout(ms);
  return trigger.locator('xpath=ancestor::div[1]').locator('.menu');
};

// Every page the run opens reports into the same list, tagged by whoever opened it.
const watch = (pg, tag = '') => {
  pg.on('console', (m) => {
    if (m.type() === 'error') failures.push(`console${tag}: ${m.text()}`);
  });
  pg.on('pageerror', (e) => failures.push(`pageerror${tag}: ${e.message}`));
};

// The number a line of toolbar text carries: "3 of 9 dates", "1 to 20 of 240". -1 when
// the line is not on the page at all, so a vanished control reads as a failed count.
const textNum = (re, g = 1) =>
  page.evaluate(
    ([source, group]) => {
      const t = [...document.querySelectorAll('main span')]
        .map((s) => (s.textContent || '').trim())
        .find((x) => new RegExp(source).test(x));
      return t ? Number(t.match(new RegExp(source))[group]) : -1;
    },
    [re.source, g]
  );

// The sidebar's rows, read once. Both checks walk this list, and the accessible name
// "Rundown (1)" is the single source for the visible label and the hotkey.
const navRows = () =>
  page.evaluate(() => {
    const aside = document.querySelector('aside').getBoundingClientRect();
    return [...document.querySelectorAll('aside nav li button')].map((btn) => {
      const box = btn.getBoundingClientRect();
      const label = btn.getAttribute('aria-label') || '';
      const m = label.match(/^(.*) \((.)\)$/);
      return {
        label,
        key: m ? m[2] : '',
        name: m ? m[1] : label,
        text: btn.innerText.replace(/\s+/g, ' ').trim(),
        current: btn.getAttribute('aria-current'),
        icon: !!btn.querySelector('svg'),
        clipped: box.left < aside.left || box.right > aside.right
      };
    });
  });

// The properties a hover may answer with. One of them moving is a state nobody sees, so
// every hover check shares the same floor of two; the map is a parameter because a
// search field carries its wash in background-image, not background-color.
const HOVER_PROPS = { border: 'borderTopColor', bg: 'backgroundColor', shadow: 'boxShadow', color: 'color' };
async function hoverMoves(loc, name, props = HOVER_PROPS) {
  const read = () =>
    loc.evaluate((node, map) => {
      const cs = getComputedStyle(node);
      return Object.fromEntries(Object.entries(map).map(([k, css]) => [k, cs[css]]));
    }, props);
  const idle = await read();
  await loc.hover();
  await page.waitForTimeout(220);
  const over = await read();
  const changed = Object.keys(idle).filter((k) => idle[k] !== over[k]);
  console.log(`hover ${String(name).padEnd(16)} ${changed.length ? changed.join(',') : 'NOTHING'}`);
  if (changed.length < 2)
    failures.push(`hover: "${name}" repaints only ${changed.join(',') || 'nothing'}, still too subtle to notice`);
  return { idle, changed };
}

// The token as the loaded stylesheet actually resolves it: paint it on a spare span,
// read the computed colour back, drop the span. Six checks wrote these four lines.
const cssColor = (expr, sel) =>
  page.evaluate(([e, s]) => {
    const p = document.createElement('span');
    p.style.color = e;
    (s ? document.querySelector(s) : document.body).appendChild(p);
    const v = getComputedStyle(p).color;
    p.remove();
    return v;
  }, [expr, sel]);

// sRGB linearisation: the one place the knee lives, shared by the contrast and the
// L*/Lab maths below.
const lin = (v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const between = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (hi + 0.05) / (lo + 0.05);
};

// An /alpha surface on a token computes to an oklab() string, and reading its numbers
// as channels yields something like [0.65, 0.03, 0.17] — a near-black that never
// exists on screen. Every layer therefore goes through the same 1px canvas the rest of
// this file uses, so the stack being composited is the colour the pixel actually has.
const read = async (spec) => {
  const q = typeof spec === 'string' ? { sel: spec } : spec;
  const raw = await page.evaluate((s) => {
    const cands = [...document.querySelectorAll(s.sel)];
    const el = s.all
      ? cands
      : [s.text ? cands.find((e) => (e.textContent || '').includes(s.text)) : cands[0]].filter(Boolean);
    if (!el.length) return null;
    return el.map((node) => {
      const layers = [];
      for (let n = node; n; n = n.parentElement) layers.push(getComputedStyle(n).backgroundColor);
      const span = node.querySelector('span') ?? node;
      return { layers, text: getComputedStyle(span).color, label: (span.textContent || span.value || '').trim() };
    });
  }, q);
  if (!raw) return null;
  return Promise.all(
    raw.map(async (one) => {
      const painted = await paint(one.layers.concat(one.text));
      const text = painted.pop().slice(0, 3);
      // getImageData hands back alpha as 0-255; fillOf composites in 0-1.
      const stack = painted.map((c) => [c[0], c[1], c[2], c[3] / 255]);
      const stop = stack.findIndex((c) => c[3] >= 1);
      return { layers: stack.slice(0, stop < 0 ? stack.length : stop + 1), text, label: one.label };
    })
  ).then((list) => (q.all ? list : list[0]));
};

// Composite the ancestor fills top down over the first opaque one. Only the fills are
// compared, so an accent wash carried in `background-image` is not counted: the
// separation this asserts is the conservative floor of what the eye sees.
const fillOf = (r) => {
  let bg = r.layers[r.layers.length - 1].slice(0, 3);
  for (let i = r.layers.length - 2; i >= 0; i--) {
    const [cr, cg, cb, ca] = r.layers[i];
    bg = [cr * ca + bg[0] * (1 - ca), cg * ca + bg[1] * (1 - ca), cb * ca + bg[2] * (1 - ca)];
  }
  return bg;
};

// The palette is a set of claims, not a list of tastes: two series hues that a
// colour-blind reviewer cannot tell apart, or a role that fails AA on its own card, are
// both invisible to every other check in this file because they only show up when two
// specific colours sit next to each other. Pure arithmetic on the hexes, so it runs even
// when the page never loaded.
const toRgbArr = (hex) => hexToRgbTriplet(hex).split(' ').map(Number);
const toLab = (c) => {
  const [R, G, B] = c.map(lin);
  const t = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  const [fx, fy, fz] = [
    t((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047),
    t(0.2126 * R + 0.7152 * G + 0.0722 * B),
    t((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883)
  ];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};
const dE76 = (a, b) => {
  const [x, y, z] = toLab(a);
  const [p, q, r] = toLab(b);
  return Math.hypot(x - p, y - q, z - r);
};

function checkPalette() {
  // Every role that carries text, against the card it actually sits on. `page` and the
  // hairlines are excluded: they are surfaces and separators, never glyphs, and holding
  // them to 4.5 would just force the ramp apart.
  const TEXT = ['ink', 'ink-muted', 'ink-faint', 'accent-fg', 'success', 'danger', 'critical', 'warning', 'talk', 'throughput', 'break-time', 'region'];
  for (const [id, mode] of Object.entries(COLOR_MODES)) {
    const c = mode.colors;
    for (const role of TEXT) {
      const ratio = between(toRgbArr(c[role]), toRgbArr(c.surface));
      if (ratio < 4.5) failures.push(`palette [${id}]: ${role} is ${ratio.toFixed(2)}:1 on ${id}'s surface, under AA's 4.5`);
    }
    const punch = between(toRgbArr(c.accent), toRgbArr(c['accent-ink']));
    if (punch < 4.5) failures.push(`palette [${id}]: accent-ink on an accent fill is ${punch.toFixed(2)}:1, so the active tab is unreadable`);
    // A control's edge is how an editable cell is found, so WCAG 1.4.11 wants 3:1 for it;
    // hairline-strong is the only thing that draws one.
    const edge = between(toRgbArr(c['hairline-strong']), toRgbArr(c.surface));
    if (edge < 3) failures.push(`palette [${id}]: a control border is ${edge.toFixed(2)}:1 on its card, under the 3:1 a boundary owes`);
    // The hover wash is the app's only hover cue on a row, and a wash one step off the card
    // does not paint at twenty rows a screen.
    const wash = Math.abs(toLab(toRgbArr(c.surface))[0] - toLab(toRgbArr(c['surface-hover']))[0]);
    if (wash < 5) failures.push(`palette [${id}]: the hover wash is ${wash.toFixed(1)} L* from the card, so a hovered row reads unhovered`);
    // The pairs that share a word in the UI, and the six series hues that share a chart.
    for (const [a, b, floor, why] of [
      ['danger', 'critical', 20, 'a bad call and a blocked action must not be one colour'],
      ['warning', 'throughput', 20, 'the rate metric and its column header must not be one colour']
    ]) {
      const d = dE76(toRgbArr(c[a]), toRgbArr(c[b]));
      if (d < floor) failures.push(`palette [${id}]: ${a} and ${b} are ΔE ${d.toFixed(1)} apart, under ${floor} — ${why}`);
    }
    for (let i = 0; i < SERIES_ROLES.length; i++) {
      for (let j = i + 1; j < SERIES_ROLES.length; j++) {
        const [a, b] = [SERIES_ROLES[i], SERIES_ROLES[j]];
        const d = dE76(toRgbArr(c[a]), toRgbArr(c[b]));
        if (d < 25) failures.push(`palette [${id}]: chart series ${a}/${b} are ΔE ${d.toFixed(1)} apart, under 25 — one legend swatch will read as the other`);
      }
    }
  }
  const ids = Object.keys(COLOR_MODES);
  for (const role of Object.keys(COLOR_MODES[DEFAULT_MODE].colors)) {
    for (const id of ids) {
      if (!COLOR_MODES[id].colors[role]) failures.push(`palette: ${id} has no ${role}, so switching modes leaves it on the previous value`);
    }
  }
  console.log(`palette      ${ids.length} modes x ${Object.keys(COLOR_MODES[DEFAULT_MODE].colors).length} roles · AA + ΔE floors hold`);
}

// The frosted model was deleted, not restyled, and nothing about a flat repaint fails
// loudly enough to show up in a screenshot. `backdrop-filter` in particular survives as a
// single utility class on one element and silently drags the whole translucency model back
// in, so the floor is asserted both in the sheet that defines the primitives and in the
// computed style of every element the app actually renders.
async function checkFlat() {
  // Comments stripped first: the sheet explains at length why `backdrop-filter` is gone,
  // and prose about a deleted property must not read as the property being declared.
  const css = readFileSync('src/index.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const gone of ['backdrop-filter', 'pulseSlow', '.dot-layer', '.dot-bg', '.blob', '.glass-', '.glow-']) {
    if (css.includes(gone)) failures.push(`flat: src/index.css still contains "${gone}", which the repaint deleted`);
  }
  await press('1');
  const live = await page.evaluate(() => {
    const all = [...document.querySelectorAll('body *')];
    return {
      blur: all.filter((el) => {
        const b = getComputedStyle(el).backdropFilter;
        return b && b !== 'none';
      }).length,
      classes: all.filter((el) => /backdrop-|glass|glow|dot-layer|dot-bg|\bblob\b/.test(el.getAttribute('class') || '')).length
    };
  });
  console.log(`flat         blur=${live.blur} legacy-classes=${live.classes}`);
  if (live.blur) failures.push(`flat: ${live.blur} rendered element(s) still apply a backdrop blur`);
  if (live.classes) failures.push(`flat: ${live.classes} rendered element(s) still carry a glass/glow/dot class`);
}

// Switching modes is the one interaction that reaches every surface in the app *and* the
// chart bitmaps, and the bitmap half has no other proof: a canvas holds pixels, so a
// stylesheet can be perfectly re-themed while the chart stays painted in the old palette.
async function checkModeSwitch() {
  const other = Object.keys(COLOR_MODES).find((id) => id !== DEFAULT_MODE);
  const read = () =>
    page.evaluate((k) => ({
      mode: document.documentElement.getAttribute('data-mode'),
      surface: getComputedStyle(document.documentElement).getPropertyValue('--k-surface').trim(),
      stored: localStorage.getItem(k)
    }), 'cati_cdr_studio_color_mode');

  // The switch is chrome, so the check starts on a view rather than on the page that
  // used to own it — and the rundown is where re-theming is hardest to get right, with
  // the hairlines, the sunken chrome and the table all reading the same palette.
  await press('1');
  const before = await read();
  const flip = page.getByRole('button', { name: new RegExp(COLOR_MODES[other].label, 'i') }).first();
  if (!(await flip.count())) {
    failures.push(`mode: the bar has no "${COLOR_MODES[other].label}" switch, so the toggle cannot be reached`);
    return;
  }
  if (await flip.getAttribute('aria-pressed') !== 'false') {
    failures.push(`mode: the ${COLOR_MODES[other].label} switch reports aria-pressed while ${before.mode} is active`);
  }
  await flip.click();
  await page.waitForTimeout(300);
  const after = await read();
  if (after.mode !== other) failures.push(`mode: clicking ${COLOR_MODES[other].label} left data-mode at "${after.mode}"`);
  if (after.surface === before.surface) failures.push('mode: the --k-* variables did not change, so the toggle repaints nothing');
  if (after.stored !== JSON.stringify(other)) failures.push(`mode: localStorage holds ${after.stored}, not "${other}" — the choice will not survive a reload`);
  if (await flip.getAttribute('aria-pressed') !== 'true') failures.push(`mode: the ${COLOR_MODES[other].label} switch is not aria-pressed once it is the active one`);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('main', { timeout: 20000 });
  await page.waitForTimeout(400);
  const kept = await read();
  if (kept.mode !== other) failures.push(`mode: after a reload the app is back in "${kept.mode}", the stored choice was ignored`);

  await press('3', 1200);
  const litLum = await bitmapLum();
  await press('5');
  await page.getByRole('button', { name: new RegExp(COLOR_MODES[DEFAULT_MODE].label, 'i') }).first().click();
  await page.waitForTimeout(300);
  await press('3', 1200);
  const darkLum = await bitmapLum();
  console.log(`mode         ${before.mode}->${after.mode} stored=${JSON.stringify(after.stored)} reload=${kept.mode} chartL ${litLum?.toFixed(3)} vs ${darkLum?.toFixed(3)}`);
  if (litLum === null || darkLum === null) {
    failures.push('mode: no analytics canvas to measure, so the bitmap half of the toggle is unproven');
  } else if (Math.abs(litLum - darkLum) < 0.1) {
    // Measured: dark mode paints its chart ink at mean L 0.34, light mode at 0.20. The
    // floor is a third of that gap — enough to prove the bitmap followed the mode, tight
    // enough that a chart which ignored it would still fail.
    failures.push(`mode: the chart ink barely changed between modes (${darkLum.toFixed(3)} vs ${litLum.toFixed(3)}), so themeColor() is not reaching the bitmap`);
  }
}

// Mean luminance of the *opaque* pixels, on a stride: a full read of a 900x280 canvas is
// 100k points and the mean of a few hundred is the same number to three decimals.
// Transparent pixels are skipped rather than counted as black — Chart.js paints no
// background, so a plain average would measure ink coverage and read a light-mode chart
// (dark ink, low luminance) as the darker of the two. Over white paper it is the ink
// colour that has to be dark.
const bitmapLum = () =>
  page.evaluate(() => {
    const cv = document.querySelector('main canvas');
    if (!cv) return null;
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    const f = (v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
    let sum = 0;
    let n = 0;
    for (let i = 0; i < d.length; i += 4 * 97) {
      if (d[i + 3] < 128) continue;
      sum += 0.2126 * f(d[i]) + 0.7152 * f(d[i + 1]) + 0.0722 * f(d[i + 2]);
      n++;
    }
    return n ? sum / n : null;
  });

watch(page);

// A run must not inherit whatever the last one left active, so put a known dataset in
// through the same endpoint the app uses to seed an empty database on boot. Waiting for
// rows below is then the check that the app loads what the server holds.
await page.request.post(`${BASE}/api/calls/demo`, { data: {} });
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('main tbody tr', { timeout: 20000 });
await checkLayers();
checkPalette();
await checkFlat();
await checkChrome();
await checkInteractions();
await checkTone();
await checkThreshold();
await checkDetail();
await checkCellSteppers();
await checkOverrideLedger();
await checkCopy();
await checkFieldHover();
await checkToolbarFits();
await checkControlHeights();
await checkMotion();
await checkPrintTone();
await checkPrint();
await checkExports();
await checkCalendar();
await checkRawCdrFilter();
await checkInk();
await checkAlign();
await checkDirectory();
await checkViewTitles();
await checkDayGroups();
await checkA11y();
// Last: it reloads, and it leaves the app in a different mode than it found it.
await checkModeSwitch();

// The mapping list burned a full page of width on two short values. The grid is the
// fix, so measure the packing rather than trusting the class names.
async function checkDirectory() {
  await press('4');
  const r = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('main .panel.lift')];
    if (!cards.length) return null;
    const grid = cards[0].parentElement;
    const cs = getComputedStyle(grid);
    // Fractional tops round apart inside a single grid row, so group by distance
    // from the highest card instead of by a rounded value.
    const tops = cards.map((c) => c.getBoundingClientRect().top);
    const min = Math.min(...tops);
    const perRow = tops.filter((t) => t - min < 3).length;
    return {
      n: cards.length,
      display: cs.display,
      tracks: cs.gridTemplateColumns.split(' ').length,
      perRow,
      cardW: Math.round(cards[0].getBoundingClientRect().width),
      gridW: Math.round(grid.getBoundingClientRect().width),
      table: !!document.querySelector('main table')
    };
  });
  if (!r) {
    failures.push('directory: no mapping cards rendered');
    return;
  }
  console.log(`grid   cards=${r.n} display=${r.display} tracks=${r.tracks} perRow=${r.perRow} card=${r.cardW}/${r.gridW}px table=${r.table}`);
  if (r.display !== 'grid') failures.push(`directory: the mappings lay out as "${r.display}", not a grid`);
  if (r.tracks < 2) failures.push(`directory: the grid has ${r.tracks} column at ${VIEWPORT.width}px, the horizontal space is still wasted`);
  if (r.perRow !== r.tracks) failures.push(`directory: the grid declares ${r.tracks} tracks but only ${r.perRow} cards share the first row`);
  if (r.cardW > r.gridW * 0.6) failures.push(`directory: a card takes ${r.cardW}px of ${r.gridW}px, barely narrower than the panel`);
  if (r.table) failures.push('directory: a table is still rendering, the list structure survived the revamp');
  await shot(page, `${OUT}/directory.png`, { fullPage: true });
}


// The brief: a popover is the colour of the button that owns it. Measured against
// the trigger's own icon rather than a restated hex, so it survives a mode switch
// and it fails if the hue is wired to the menu but not to the button.
async function checkTone() {
  await press('1');

  const key = (a) => (a ? a.join(',') : 'none');

  async function probe(label) {
    const trigger = page.locator('main button[aria-expanded]').filter({ hasText: label }).first();
    if (!(await trigger.count())) {
      failures.push(`tone: no "${label}" popover to open`);
      return null;
    }
    // The idle trigger colours its icon through the tone map, so the icon is the hue
    // the user says the menu should match.
    const icon = chan(await trigger.locator('svg').first().evaluate((el) => getComputedStyle(el).color));
    const menu = await openMenu(trigger);
    if (!(await menu.count())) {
      failures.push(`tone: "${label}" never opened a menu`);
      return null;
    }
    const r = await menu.evaluate((el) => {
      const p = document.createElement('span');
      p.style.color = 'rgb(var(--tone, var(--k-accent-fg)) / 1)';
      el.appendChild(p);
      const tone = getComputedStyle(p).color;
      p.remove();
      const on = el.querySelector('.cbox:checked');
      const field = el.querySelector('.field');
      let fieldBorder = null;
      if (field) {
        field.focus();
        fieldBorder = getComputedStyle(field).borderTopColor;
        field.blur();
      }
      const btn = el.querySelector('.tone-btn');
      // Read before anything is hovered: the panel's chrome (All/None, the drag grips)
      // wears the trigger's hue at rest, while the option rows let the plate show through.
      const chrome = el.querySelector('.hoverable:not(.menu-item)');
      const row = el.querySelector('.menu-item');
      return {
        tone,
        border: getComputedStyle(el).borderTopColor,
        plate: getComputedStyle(el).backgroundImage,
        fill: on ? getComputedStyle(on).backgroundColor : null,
        hasBox: !!on,
        btn: btn ? getComputedStyle(btn).backgroundColor : null,
        fieldBorder,
        wash: chrome ? getComputedStyle(chrome).backgroundColor : null,
        rowBg: row ? getComputedStyle(row).backgroundColor : null,
        rows: el.querySelectorAll('.menu-item').length
      };
    });
    // The hover step, in the tone too: a border that repaints to some other hue is
    // the half-finished version of the same bug. A panel that has saved nothing yet
    // has no option rows, so absence is skipped rather than hunted.
    const item = menu.locator('.menu-item').first();
    let hoverBorder = null;
    let hoverRow = null;
    if (await item.count()) {
      await item.hover();
      await page.waitForTimeout(200);
      hoverBorder = chan(await item.evaluate((el) => getComputedStyle(el).borderTopColor));
      hoverRow = await item.evaluate((el) => getComputedStyle(el).backgroundColor);
    }
    await press('Escape', 150);
    return {
      icon,
      tone: chan(r.tone),
      border: chan(r.border),
      fill: r.fill ? chan(r.fill) : null,
      hoverBorder,
      hasBox: r.hasBox,
      btn: r.btn ? chan(r.btn) : null,
      fieldBorder: r.fieldBorder ? chan(r.fieldBorder) : null,
      wash: r.wash ? chan(r.wash) : null,
      // The fourth number in `rgba(r, g, b, a)` is the strength of the wash, and the
      // brief was "the trigger's clicked tint, a step lower".
      washA: r.wash ? Number((r.wash.match(/[\d.]+/g) || [])[3]) : null,
      rowBg: r.rowBg,
      rows: r.rows,
      plate: (r.plate.match(/[\d.]+/g) || []).length >= 4 ? chan(r.plate) : null,
      plateA: (r.plate.match(/[\d.]+/g) || []).length >= 4 ? Number(r.plate.match(/[\d.]+/g)[3]) : null,
      hoverRow: hoverRow && !/rgba\(0, 0, 0, 0\)|transparent/.test(hoverRow) ? chan(hoverRow) : null,
      hoverRowA: hoverRow ? Number((hoverRow.match(/[\d.]+/g) || [])[3]) || 0 : null
    };
  }

  const agents = await probe('Agents');
  const columns = await probe('Columns');
  const views = await probe('Views');
  if (!agents || !columns || !views) return;

  const trio = (p) =>
    `chrome=${key(p.wash)}@${p.washA} rowRest=${key(chan(p.rowBg))} rowHover=${key(p.hoverRow)}@${p.hoverRowA} plate=${key(p.plate)}@${p.plateA}`;
  console.log(
    `tone agents  icon=${key(agents.icon)} menu=${key(agents.tone)} border=${key(agents.border)} box=${key(agents.fill)} hover=${key(agents.hoverBorder)} ${trio(agents)}`
  );
  console.log(
    `tone columns  icon=${key(columns.icon)} menu=${key(columns.tone)} border=${key(columns.border)} box=${key(columns.fill)} hover=${key(columns.hoverBorder)} ${trio(columns)}`
  );
  console.log(
    `tone views  icon=${key(views.icon)} menu=${key(views.tone)} border=${key(views.border)} btn=${key(views.btn)} field=${key(views.fieldBorder)} ${trio(views)}`
  );

  if (key(agents.tone) === key(columns.tone)) {
    failures.push(`tone: the Agents and Columns menus share hue ${key(agents.tone)}, the popover is not following its trigger`);
  }
  for (const [name, p] of [['agents', agents], ['columns', columns], ['views', views]]) {
    if (!near(p.icon, p.tone, 1)) failures.push(`tone [${name}]: the menu is ${key(p.tone)} but its trigger icon is ${key(p.icon)}`);
    if (!near(p.icon, p.border, 1)) failures.push(`tone [${name}]: the menu edge is ${key(p.border)}, not the trigger's ${key(p.icon)}`);
    if (p.hoverBorder && !near(p.icon, p.hoverBorder, 1)) failures.push(`tone [${name}]: a hovered menu item lights ${key(p.hoverBorder)} instead of ${key(p.icon)}`);
    // A checked box is the loudest element in the panel; a blue tick in an amber menu
    // reads as two different apps stitched together.
    if (p.hasBox) {
      if (!p.fill) failures.push(`tone [${name}]: the menu has a checked box but no fill to read`);
      else if (!near(p.icon, p.fill, 1)) failures.push(`tone [${name}]: a checked box fills ${key(p.fill)}, not the trigger's ${key(p.icon)}`);
    }
    // Controls the panel owns, painted by the call site rather than the stylesheet.
    if (p.btn && !near(p.icon, p.btn, 1)) failures.push(`tone [${name}]: the panel's primary button is ${key(p.btn)}, not the trigger's ${key(p.icon)}`);
    if (p.fieldBorder && !near(p.icon, p.fieldBorder, 1)) failures.push(`tone [${name}]: a focused field in the panel edges to ${key(p.fieldBorder)}, not the trigger's ${key(p.icon)}`);
    // The panel chrome — All/None, the drag grips, the per-row icons — wears the trigger's
    // hue at rest, a step under the /0.10 the clicked trigger wears.
    if (p.wash) {
      if (!near(p.icon, p.wash, 1)) failures.push(`tone [${name}]: the panel chrome sits on ${key(p.wash)}, not the trigger's ${key(p.icon)}`);
      if (!(p.washA > 0 && p.washA < 0.1)) failures.push(`tone [${name}]: the panel chrome washes at ${p.washA}, which is not below the trigger's 0.1`);
    }
    // The option rows are the plate's own colour until the pointer arrives: a resting strip
    // under every name is the stack-of-buttons look the brief is meant to have left.
    if (p.rows) {
      if (!/rgba\(0, 0, 0, 0\)|transparent/.test(p.rowBg || '')) failures.push(`tone [${name}]: a menu row rests on ${p.rowBg}, so it is a strip, not the plate`);
      if (!p.hoverRow || !near(p.icon, p.hoverRow, 1)) failures.push(`tone [${name}]: hovering a menu row paints ${key(p.hoverRow)}, not the trigger's ${key(p.icon)}`);
      if (!(p.hoverRowA > 0.1)) failures.push(`tone [${name}]: a hovered menu row tints at ${p.hoverRowA}, too faint to find under the pointer`);
    }
    // The plate itself, not just its rows: a grey panel with tinted rows in it is the
    // half-finished version of the same idea.
    if (p.plate) {
      if (!near(p.icon, p.plate, 1)) failures.push(`tone [${name}]: the plate is washed ${key(p.plate)}, not the trigger's ${key(p.icon)}`);
      if (!(p.plateA > 0 && p.plateA < 0.1)) failures.push(`tone [${name}]: the plate washes at ${p.plateA}, which is not below the trigger's 0.1`);
    }
  }
  if (!views.btn) failures.push('tone [views]: the Save button lost its .tone-btn class, it is accent again');
}

// The break threshold control: one outlined pill holding a centred number and a
// stepper that commits rather than leaving a draft behind.
async function checkThreshold() {
  await press('1');
  const field = page.locator('main input[aria-label="Idle break threshold in minutes"]');
  if (!(await field.count())) {
    failures.push('threshold: no break threshold field to measure');
    return;
  }
  const pill = field.locator('xpath=ancestor::div[1]');
  const rest = await field.evaluate((el) => {
    const cs = getComputedStyle(el);
    // The pill is dressed as a button now, so it is found by its place in the tree:
    // the input's wrapper is a span and the nearest div above it is the pill.
    const p = el.closest('div');
    const pcs = getComputedStyle(p);
    return {
      value: el.value,
      align: cs.textAlign,
      wellBg: cs.backgroundColor,
      wellBorder: cs.borderTopWidth,
      wellEdge: cs.borderTopColor,
      pillBg: pcs.backgroundColor,
      border: parseFloat(pcs.borderTopWidth),
      color: pcs.borderTopColor,
      shadow: pcs.boxShadow,
      icon: getComputedStyle(p.querySelector('svg')).color
    };
  });
  console.log(`threshold ${rest.value}min border=${rest.border}px ${rest.color} align=${rest.align}`);
  if (rest.border < 1) failures.push('threshold: the pill has no edge, it is a bare box in the toolbar');
  if (/rgba\(0, 0, 0, 0\)|transparent/.test(rest.color)) failures.push('threshold: the pill border is transparent');
  if (rest.align !== 'center') failures.push(`threshold: the value is "${rest.align}"-aligned in a fixed box`);
  // The number has to read as the typeable part of the control: an edge of its own that
  // stays neutral until the pointer or the caret arrives. A permanently violet well is
  // the second lit outline in one pill that started this; no well edge at all is text
  // painted straight onto the pill.
  if (rest.wellBg === rest.pillBg) failures.push('threshold: the number shares the pill fill, so the editable box is invisible');
  if (parseFloat(rest.wellBorder) < 1) failures.push('threshold: the number has no edge of its own, so it is not a box');

  // Every other field in this toolbar lights up under the pointer. This one used to
  // sit dead, because its outline was a `ring-*` utility outside the hover contract.
  const pillBox = await pill.boundingBox();
  const crop = clip(pillBox, 12);
  await shot(page, `${OUT}/threshold-idle.png`, { clip: crop });
  await page.mouse.move(pillBox.x + 6, pillBox.y + pillBox.height / 2);
  await page.waitForTimeout(220);
  const hov = await pill.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { color: cs.borderTopColor, shadow: cs.boxShadow, fill: cs.backgroundColor };
  });
  await shot(page, `${OUT}/threshold-hover.png`, { clip: crop });
  console.log(`hover threshold  ${rest.color} ${rest.shadow} -> ${hov.color} ${hov.shadow}`);
  if (hov.color === rest.color) failures.push('threshold: hovering the pill never moved its edge, the control is dead to the pointer');
  // The pill is dressed like the buttons in this row, so it has to answer the pointer
  // like them: an edge and a fill, not a cast shadow.
  if (hov.fill === rest.pillBg) failures.push('threshold: hovering the pill leaves its fill alone, unlike the buttons beside it');
  // One control, one hue. The pill's hover edge is the tone at a twelfth, so it is read
  // as the rgb the browser was handed rather than composited: a faint edge still has to
  // be *this* control's faint edge, and compositing it over the page would only prove
  // the alpha is low.
  const glyph = chan(rest.icon);
  const wellRest = chan(rest.wellEdge);
  const hovEdge = chan(hov.color);
  const hovA = Number((hov.color.match(/[\d.]+/g) || [])[3]);
  console.log(`hue threshold    glyph=${rgb(glyph)} well=${rgb(wellRest)} hover=${rgb(hovEdge)}@${hovA}`);
  if (!near(hovEdge, glyph))
    failures.push(`threshold: hovering lights ${rgb(hovEdge)} while this control's own hue is ${rgb(glyph)}`);
  if (hovA > 0.2) failures.push(`threshold: the hover edge is ${hovA} of the tone, a lit ring rather than a nudge`);
  if (near(wellRest, glyph))
    failures.push(`threshold: the well is ${rgb(glyph)} at rest, so the pill holds two coloured outlines again`);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(80);

  // The carets belong inside the field. If they escape the box they are flanking
  // buttons again, which is the width this layout cannot afford.
  const nest = await page.evaluate(() => {
    const i = document.querySelector('main input[aria-label="Idle break threshold in minutes"]').getBoundingClientRect();
    const u = document.querySelector('main button[aria-label="Increase the break threshold by one minute"]').getBoundingClientRect();
    return u.left >= i.left && u.right <= i.right + 0.5 && u.top >= i.top - 0.5 && u.bottom <= i.bottom + 0.5;
  });
  if (!nest) failures.push('threshold: the stepper sits outside the field, it is costing the toolbar width again');

  // The pill gained two stepper buttons, so the crops above are here to catch it
  // overflowing its own container rather than wrapping cleanly.
  await field.focus();
  await page.waitForTimeout(180);
  const wellLit = chan(await field.evaluate((el) => getComputedStyle(el).borderTopColor));
  console.log(`focus well     ${rgb(wellLit)}`);
  if (!near(wellLit, glyph)) failures.push(`threshold: the focused well is ${rgb(wellLit)}, not the control's ${rgb(glyph)}`);
  await shot(page, `${OUT}/threshold-focus.png`, { clip: crop });
  await field.blur();

  const step = async (label) => {
    await page.locator(`main button[aria-label="${label}"]`).click();
    await page.waitForTimeout(260);
    return field.inputValue();
  };
  const up = await step('Increase the break threshold by one minute');
  const toast = await page
    .getByText(new RegExp(`Break threshold updated to ${Number(rest.value) + 1} min`))
    .count();
  const down = await step('Decrease the break threshold by one minute');
  console.log(`steppers  +1=${up} toast=${toast} -1=${down}`);
  if (String(Number(rest.value) + 1) !== up) failures.push(`threshold: + set the field to "${up}" from "${rest.value}"`);
  if (!toast) failures.push('threshold: + changed the draft but never committed it, no recalculation reported');
  if (String(Number(up) - 1) !== down) failures.push(`threshold: - set the field to "${down}" from "${up}"`);
}

// How a row behaves, and how a panel closes. Both were wrong by accident at some
// point: the whole row opened the agent panel, and the close button hovered accent
// blue like every other control.
async function checkDetail() {
  await press('1');

  const accent = await cssColor('rgb(var(--k-accent-fg))');
  const chip = await page.evaluate(() => {
    const el = document.querySelector('main tbody tr td:nth-child(3) > span');
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { text: el.innerText.trim(), bg: cs.backgroundColor, color: cs.color, radius: parseFloat(cs.borderRadius) || 0 };
  });
  console.log(`chip   calls="${chip?.text}" bg=${chip?.bg} text=${chan(chip?.color).join(',')} accent=${chan(accent).join(',')} radius=${chip?.radius}`);
  if (!chip) failures.push('chip: no total-calls cell to read');
  else {
    if (/rgba\(0, 0, 0, 0\)|transparent/.test(chip.bg)) failures.push(`chip: the total sits on nothing (bg=${chip.bg}), it is not a chip`);
    if (chip.radius < 2) failures.push(`chip: the total's corners are ${chip.radius}px, it is a raw block not a chip`);
    if (!rgbNear(chip.color, accent)) failures.push(`chip: the total reads ${chan(chip.color).join(',')}, a flat grey on grey is the bland version`);
  }

  await page.locator('main tbody tr').nth(1).click();
  await page.waitForTimeout(400);
  if (await page.locator('[role="dialog"]').count()) {
    failures.push('details: clicking a row opens the agent panel, only the Details button should');
    await press('Escape', 300);
  }

  await page.locator('main tbody tr [aria-label^="Breakdown for"]').first().click();
  await page.waitForTimeout(500);
  const close = page.locator('[role="dialog"] button[aria-label="Close"]');
  if (!(await close.count())) {
    failures.push('details: the Details button no longer opens the panel');
    return;
  }
  const want = await cssColor('rgb(var(--k-danger) / 1)');
  const paint = await close.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { color: cs.color, bg: cs.backgroundColor };
  });
  await close.hover();
  await page.waitForTimeout(220);
  const on = await close.evaluate((el) => {
    const cs = getComputedStyle(el);
    return `${cs.color}|${cs.backgroundColor}|${cs.boxShadow}`;
  });
  const rest = `${paint.color}|${paint.bg}`;
  console.log(`close  danger=${chan(want).join(',')} idle=${chan(paint.color).join(',')} bg=${chan(paint.bg).join(',')}`);
  if (!rgbNear(want, paint.color))
    failures.push(`close: the button is ${chan(paint.color).join(',')}, not the scheme's danger ${chan(want).join(',')}`);
  if (/rgba\(0, 0, 0, 0\)|transparent/.test(paint.bg)) failures.push('close: the button has no red wash behind it');
  if (rest === on) failures.push('close: hovering the button repaints nothing');

  // The sheet is a report now, not three tiles: the shift's own numbers, a chart of the
  // hour, and the redial count only the raw rows can give.
  const report = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return { canvas: !!d.querySelector('canvas'), facts: d.querySelectorAll('dt').length, redials: /Redialled numbers/.test(d.innerText) };
  });
  console.log(`sheet  chart=${report.canvas} facts=${report.facts} redials=${report.redials}`);
  if (!report.canvas) failures.push('details: the sheet draws no chart, the hour-by-hour read is gone');
  if (report.facts < 12)
    failures.push(`details: the sheet lists ${report.facts} facts, the numbers the rundown row already holds are not all there`);
  if (!report.redials) failures.push('details: the sheet never says how many numbers were redialled');

  await close.click();
  await page.waitForTimeout(400);
  if (await page.locator('[role="dialog"]').count()) failures.push('close: the X no longer dismisses the panel');
}

// The editable cells carry the same in-field steppers as the break threshold, so a
// click has to land in the data and not just in the box.
async function checkCellSteppers() {
  await press('1');

  // Half dones and surveys are the only editable cells in the grid. An outline is what
  // says "you can type here" without the number looking like a button, and it has to be
  // the value's own hue — a blue edge on a green survey count is the same flaw the
  // threshold pill had.
  const cells = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'rgb(var(--k-accent-fg))';
    document.body.appendChild(probe);
    const accent = getComputedStyle(probe).color;
    probe.remove();
    return [...document.querySelectorAll('main tbody tr:first-child input')].map((el) => {
      const cs = getComputedStyle(el);
      return {
        label: (el.getAttribute('aria-label') || '').split(' for ')[0],
        width: parseFloat(cs.borderTopWidth),
        text: cs.color,
        edge: cs.borderTopColor,
        accent
      };
    });
  });
  console.log(`outline ${cells.map((c) => `${c.label}=${c.width}px`).join(' ')}`);
  if (cells.length < 2) failures.push(`outline: found ${cells.length} editable cells in the first row, expected half dones and surveys`);
  const painted = await paint(cells.map((c) => [c.text, c.edge, c.accent]).flat());
  cells.forEach((c, i) => {
    const [text, edge, accent] = [0, 1, 2].map((k) => painted[i * 3 + k]);
    const a = edge[3] / 255;
    if (c.width < 1) failures.push(`outline: ${c.label} has a ${c.width}px edge, the field is unmarked`);
    if (a <= 0.02) failures.push(`outline: ${c.label}'s edge paints at ${a.toFixed(2)}, it is invisible`);
    if (a > 0.6) failures.push(`outline: ${c.label}'s edge paints at ${a.toFixed(2)}, that is a slab not a hint`);
    if (!near(edge.slice(0, 3), text.slice(0, 3)))
      failures.push(`outline: ${c.label}'s edge is ${rgb(edge.slice(0, 3))} while its value is ${rgb(text.slice(0, 3))}`);
    if (!near(text.slice(0, 3), accent.slice(0, 3)) && near(edge.slice(0, 3), accent.slice(0, 3)))
      failures.push(`outline: ${c.label}'s edge is the app accent ${rgb(accent.slice(0, 3))}, not the value's own hue`);
  });
  const box = await page.locator('main tbody tr').first().locator('input').evaluateAll((els) =>
    els.map((el) => {
      const td = el.closest('td').getBoundingClientRect();
      return { x: td.x, y: td.y, right: td.right, h: td.height };
    })
  );
  await shot(page, `${OUT}/cell-outline.png`, {
    clip: { x: box[0].x - 8, y: box[0].y - 34, width: box.at(-1).right - box[0].x + 16, height: box[0].h + 42 }
  });
  // Hovering has to strengthen the same edge, not swap in the accent.
  const field = page.locator('main tbody tr').first().locator('input').first();
  await field.hover();
  await page.waitForTimeout(120);
  const hov = await field.evaluate((el) => getComputedStyle(el).borderTopColor);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(120);
  const [restEdge, hovEdge] = await paint([cells[0].edge, hov]);
  console.log(`outline hover    ${cells[0].label} a=${restEdge[3] / 255} -> ${hovEdge[3] / 255} ${rgb(hovEdge.slice(0, 3))}`);
  if (near(restEdge, hovEdge))
    failures.push(`outline: hovering ${cells[0].label} leaves the edge at ${rgb(hovEdge.slice(0, 3))} a=${(hovEdge[3] / 255).toFixed(2)}, the field ignores the pointer`);
  if (!near(hovEdge.slice(0, 3), restEdge.slice(0, 3)))
    failures.push(`outline: hovering ${cells[0].label} changes hue to ${rgb(hovEdge.slice(0, 3))}, the edge is not its own`);

  const input = page.locator('main tbody tr').first().locator('input').first();
  const label = await input.getAttribute('aria-label');
  const before = await input.inputValue();
  const up = page.getByLabel(`Increase ${label}`, { exact: true }).first();
  const down = page.getByLabel(`Decrease ${label}`, { exact: true }).first();
  // Two each way: a caret that only survives one click still looks fine until the
  // second one re-reads a draft the first click threw away.
  await up.click();
  await page.waitForTimeout(200);
  await up.click();
  await page.waitForTimeout(200);
  const after = await input.inputValue();
  await down.click();
  await page.waitForTimeout(200);
  await down.click();
  await page.waitForTimeout(200);
  const back = await input.inputValue();
  console.log(`cell stepper ${label?.split(' for ')[0]} ${before} -> ${after} -> ${back}`);
  if (String(Number(before) + 2) !== after) failures.push(`cell stepper: two + left "${after}" from "${before}", the clicks do not accumulate`);
  if (String(Number(before)) !== back) failures.push(`cell stepper: two - from "${after}" landed on "${back}", not back on "${before}"`);
}

// The rundown's Half and Surveys cells write straight into localStorage, so until Settings
// listed them nothing in the app could read them back or take them off. Type a value, prove
// the ledger names the agent and the number, clear it, prove the cell follows it back down.
async function checkOverrideLedger() {
  await press('1');
  const input = page.locator('main tbody tr').first().locator('input').first();
  const label = await input.getAttribute('aria-label');
  const before = await input.inputValue();
  await input.click();
  await input.fill('3');
  await input.press('Enter');
  await page.waitForTimeout(250);

  await press('5', 400);
  const clears = page.getByRole('button', { name: /^Clear overrides for/ });
  const listed = await clears.count();
  console.log(`overrides    typed "${label}" ${before}->3, plate lists ${listed}`);
  if (!listed) failures.push('overrides: a typed half-done leaves the Settings plate empty, nothing can read it back');
  else {
    const detail = await clears.first().evaluate((el) => el.closest('li').textContent);
    if (!/half dones 3/.test(detail))
      failures.push(`overrides: the plate reads "${detail.trim()}", the typed value is not in it`);
    await clears.first().click();
    await page.waitForTimeout(250);
    if (await page.getByRole('button', { name: /^Clear overrides for/ }).count())
      failures.push('overrides: Clear leaves the row in the plate, the stored value never went');
  }

  await press('1', 400);
  const after = await page.locator('main tbody tr').first().locator('input').first().inputValue();
  console.log(`overrides    cleared, cell back to "${after}"`);
  if (listed && after !== before)
    failures.push(`overrides: clearing the plate left the rundown cell at "${after}", it was "${before}" before the type`);
}

// A click on a figure in the grid takes it to the clipboard. Two ways this is silently
// useless: the copy never lands (a browser that refused the write, a promise nobody reads
// back) and the cell handler stealing the click from the two cells that edit themselves.
// The third is granularity — a click on one break stamp has to take that stamp, not the
// column, or the cell copies text nobody pointed at.
async function checkCopy() {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await press('1');
  const clip = () => page.evaluate(() => navigator.clipboard.readText().catch(() => null));
  const tap = async (loc) => {
    const want = (await loc.innerText()).trim();
    await loc.click();
    await page.waitForTimeout(260);
    return { want, got: await clip() };
  };

  const cell = page.locator('main tbody tr.row-hover td').first();
  const one = await tap(cell);
  const cursor = await cell.evaluate((td) => getComputedStyle(td).cursor);
  console.log(`copy cell      "${one.want}" -> "${one.got}" cursor=${cursor}`);
  if (one.got !== one.want) failures.push(`copy: clicking "${one.want}" left "${one.got}" on the clipboard`);
  if (cursor !== 'copy') failures.push(`copy: the value cells show a ${cursor} cursor, so nothing says they can be clicked`);
  if (!(await page.getByText(`Copied ${one.want}`).count()))
    failures.push('copy: the value reached the clipboard with no word about it, which is indistinguishable from nothing happening');

  const stamp = await tap(page.locator('main tbody td .num', { hasText: ' - ' }).first());
  console.log(`copy chip      "${stamp.want}" -> "${stamp.got}"`);
  if (stamp.got !== stamp.want)
    failures.push(`copy: clicking one stamp "${stamp.want}" left "${stamp.got}", the click takes more than the value under it`);

  await page.locator('main tbody tr.row-hover input').first().click();
  await page.waitForTimeout(200);
  const kept = await clip();
  console.log(`copy edit      input click leaves "${kept}"`);
  if (kept !== stamp.got) failures.push(`copy: clicking the editable cell rewrote the clipboard to "${kept}"`);
  // Hand the keyboard back: a focused cell swallows the number keys the next check uses
  // to switch views, and it types them into the draft instead.
  await press('Escape', 200);
}

// `k-ink` is #F4F7FC in studio — white. It is the right colour for a heading and the
// wrong one for twenty rows of figures, so no cell may render its own text with it.
// Names are the exception the user asked for: prose reads better neutral than tinted.
async function checkInk() {
  const ALLOW_WHITE = ['agent'];
  const ink = await cssColor('rgb(var(--k-ink))');
  for (const [key, view] of TABLE_VIEWS) {
    await press(key);
    const white = await page.evaluate(([allow, ink]) => {
      const hits = [];
      const head = [...document.querySelectorAll('main thead th')].map((th) => th.innerText.trim().toLowerCase());
      for (const td of document.querySelectorAll('main tbody tr:first-child td')) {
        const label = head[td.cellIndex] || String(td.cellIndex);
        if (allow.includes(label)) continue;
        for (const el of [td, ...td.querySelectorAll('*')]) {
          const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          if (own && getComputedStyle(el).color === ink) {
            hits.push(`${label}:"${el.textContent.trim().slice(0, 14)}"`);
          }
        }
      }
      return hits;
    }, [ALLOW_WHITE, ink]);
    console.log(`ink ${view.padEnd(9)} white=${white.length}${white.length ? ` ${white.join(' ')}` : ''}`);
    if (white.length) failures.push(`${view}: ${white.length} cell value(s) still render in white k-ink — ${white.join(', ')}`);
  }
}


// Every column centres, head and cells alike. Asserted per label, so the failure names
// the column rather than an index someone has to go and look up.
async function checkAlign() {
  await press('1');
  const cols = await page.evaluate(() =>
    [...document.querySelectorAll('main thead th')].map((th, i) => ({
      label: th.innerText.trim().toLowerCase(),
      head: getComputedStyle(th).textAlign,
      cell: getComputedStyle(document.querySelector(`main tbody tr > td:nth-child(${i + 1})`)).textAlign
    }))
  );
  console.log(`align  ${cols.map((c) => `${c.label}:${c.head}`).join(' ')}`);
  for (const c of cols) {
    if (c.head !== c.cell) failures.push(`align: "${c.label}" centres its header (${c.head}) but not its cells (${c.cell})`);
    if (c.head !== 'center') failures.push(`align: "${c.label}" reads ${c.head}, every column is meant to centre`);
  }
}


// The complaint this guards: hover that is invisible, checkboxes that render as the
// native OS box, a Details column that can be switched off, and break stamps that
// wrap into a pile instead of a list. Each is measured, not eyeballed.
async function checkInteractions() {
  await press('1');

  // The numbers say a state exists; this is the crop for judging whether it reads.
  async function hoverStep(name, loc) {
    const target = loc.first();
    if (!(await target.count())) {
      failures.push(`hover: no "${name}" element to measure`);
      return;
    }
    await hoverMoves(target, name);
    const b = await target.boundingBox();
    if (b)
      await shot(page, `${OUT}/hover-${name.replace(/[^\w-]+/g, '-').toLowerCase()}.png`, { clip: clip(b) });
  }

  const columns = page.getByRole('button', { name: /Columns/ });
  await hoverStep('toolbar trigger', columns);
  await columns.click();
  await page.waitForTimeout(300);
  const menu = page.locator('.menu').last();
  if (!(await menu.count())) {
    failures.push('columns: the Columns popover never opened');
    return;
  }

  await hoverStep('menu item', menu.locator('.hoverable'));

  const labels = await page.evaluate(() =>
    [...document.querySelectorAll('.menu label > span')].map((s) => s.innerText.trim())
  );
  // innerText honours the head's `text-transform: uppercase`, so compare lowercase.
  const headTxt = await page.evaluate(() =>
    [...document.querySelectorAll('main thead th')].map((th) => th.innerText.trim().toLowerCase())
  );
  console.log(`columns  options=${labels.length} head=${headTxt.length} [${headTxt.join(' ')}]`);
  if (headTxt.includes('break stamps')) failures.push('breaks: the column is still labelled "Break stamps"');
  if (!headTxt.includes('breaks')) failures.push('breaks: no "Breaks" column header found');
  if (!headTxt.includes('details')) failures.push('details: the Details column is not in the table');
  if (labels.some((l) => l.toLowerCase() === 'details')) failures.push('details: Details is still a togglable option in the Columns menu');

  // The themed box: appearance is switched off, so the fill and the tick are ours.
  // The Columns menu always holds both states (some columns on, some off), so read
  // them side by side instead of clicking and mutating the view.
  const box = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.menu .cbox')];
    if (!all.length) return null;
    const on = all.find((el) => el.checked);
    const off = all.find((el) => !el.checked);
    const after = (el) => {
      const a = el ? getComputedStyle(el, '::after') : null;
      return { content: a?.content ?? 'none', w: a ? parseFloat(a.width) || 0 : 0 };
    };
    return {
      appearance: getComputedStyle(all[0]).appearance,
      size: `${getComputedStyle(all[0]).width}x${getComputedStyle(all[0]).height}`,
      unchecked: off ? getComputedStyle(off).backgroundColor : null,
      checked: on ? getComputedStyle(on).backgroundColor : null,
      tick: after(on),
      noTick: after(off)
    };
  });
  if (!box) {
    failures.push('checkbox: no .cbox in the Columns menu, the native box is back');
  } else {
    console.log(
      `checkbox appearance=${box.appearance} size=${box.size} idle=${box.unchecked} checked=${box.checked} tick=${box.tick.content} ${box.tick.w}px`
    );
    if (box.appearance !== 'none') failures.push(`checkbox: appearance is "${box.appearance}", the OS box is showing through`);
    if (!box.checked || !box.unchecked) failures.push('checkbox: the menu has only one state, cannot compare checked to unchecked');
    else if (box.checked === box.unchecked || box.checked === 'rgba(0, 0, 0, 0)')
      failures.push(`checkbox: checked fill ${box.checked} is indistinguishable from unchecked ${box.unchecked}`);
    if (!/^".*"$/.test(box.tick.content) || box.tick.w < 2)
      failures.push(`checkbox: no tick painted on the checked box (content=${box.tick.content})`);
    if (box.noTick.w > 0) failures.push('checkbox: the tick shows on unchecked boxes too');
  }
  await press('Escape', 150);

  // Rows are wide and stacked twenty deep, so they take a fill step rather than a
  // wash. Still has to be a step the eye can find. Measured with the popover closed:
  // the menu overlaps the first rows and would swallow the hover.
  const row = page.locator('main tbody tr').nth(1);
  const r0 = await row.evaluate((el) => getComputedStyle(el).backgroundColor);
  await row.hover();
  await page.waitForTimeout(200);
  const r1 = await row.evaluate((el) => getComputedStyle(el).backgroundColor);
  console.log(`hover row              ${r0} -> ${r1}`);
  if (r0 === r1) failures.push('hover: table rows keep the same fill under the cursor');

  // The cascade contract. A resting surface is @layer components and a state is
  // unlayered, which is the only reason the call-site utilities below work at all:
  // written outside a layer, .field silently outranked `focus:border-k-accent`
  // and `focus:outline-none` and every focused field looked unfocused.
  const search = page.locator('main input').first();
  const b0 = await search.evaluate((el) => getComputedStyle(el).borderTopColor);
  await search.focus();
  await page.waitForTimeout(150);
  const focused = await search.evaluate((el) => ({
    border: getComputedStyle(el).borderTopColor,
    outline: getComputedStyle(el).outlineStyle
  }));
  console.log(`focus  field      ${b0} -> ${focused.border} outline=${focused.outline}`);
  if (b0 === focused.border) failures.push('cascade: focusing a .field leaves its border alone, a surface class is beating the utility again');
  if (focused.outline !== 'none') failures.push(`cascade: the focused input still draws an "${focused.outline}" outline, :focus-visible is beating outline-none`);
  const rb = await row.boundingBox();
  if (rb) {
    await shot(page, `${OUT}/hover-table-row.png`, {
      clip: { x: Math.max(0, rb.x), y: Math.max(0, rb.y - 20), width: Math.min(rb.width, VIEWPORT.width - 1), height: rb.height + 40 }
    });
  }

  const stack = await page.evaluate(() => {
    const cells = [];
    for (const td of document.querySelectorAll('main tbody td')) {
      const kids = [...td.children];
      if (kids.length !== 1 || !kids[0].classList.contains('flex-col')) continue;
      cells.push({ wrap: kids[0], n: kids[0].querySelectorAll('span').length });
    }
    if (!cells.length) return null;
    const best = cells.reduce((a, b) => (b.n > a.n ? b : a));
    const cs = getComputedStyle(best.wrap);
    return {
      found: cells.length,
      n: best.n,
      tops: [...best.wrap.children].map((s) => Math.round(s.getBoundingClientRect().top)),
      lefts: [...new Set([...best.wrap.children].map((s) => Math.round(s.getBoundingClientRect().left)))].length,
      dir: cs.flexDirection,
      align: cs.alignItems,
      wrap: cs.flexWrap
    };
  });
  if (!stack) {
    failures.push('breaks: no stamp column rendered at all, the Breaks cell lost its flex wrapper');
  } else {
    const stacked = stack.tops.every((t, i) => i === 0 || t > stack.tops[i - 1] + 1);
    console.log(
      `breaks   cells=${stack.found} stamps=${stack.n} dir=${stack.dir} align=${stack.align} wrap=${stack.wrap} lefts=${stack.lefts} stacked=${stacked}`
    );
    if (stack.dir !== 'column') failures.push(`breaks: the stamps lay out as "${stack.dir}", they should stack below one another`);
    if (stack.wrap !== 'nowrap') failures.push(`breaks: flex-wrap is "${stack.wrap}", the column can fold sideways again`);
    if (stack.n > 1 && !stacked) failures.push(`breaks: ${stack.n} stamps are not on separate lines (tops ${stack.tops.join(',')})`);
    // Every stamp starting on the same x is what "aligned vertically" looks like.
    if (stack.lefts !== 1) failures.push(`breaks: the stamps start at ${stack.lefts} different x offsets, they are not flush left`);

  // One stamp per row can never touch a neighbour; the tall case is what matters.
  // Force it — clone stamps into the first stamped row — and require the pills to
  // stay off the row's own edges, which is the gap between stacked rows.
  const inset = await page.evaluate(() => {
    const measure = (tr) => {
      const wrap = tr.querySelector('td > .flex-col');
      if (!wrap) return null;
      const r = tr.getBoundingClientRect();
      let worst = 999;
      for (const pill of wrap.querySelectorAll(':scope > span')) {
        const s = pill.getBoundingClientRect();
        worst = Math.min(worst, s.top - r.top, r.bottom - s.bottom);
      }
      return { row: Math.round(r.height), worst: +worst.toFixed(1) };
    };
    const tr = [...document.querySelectorAll('main tbody tr')].find((t) => t.querySelector('td > .flex-col'));
    if (!tr) return null;
    const wrap = tr.querySelector('td > .flex-col');
    const one = measure(tr);
    const seed = wrap.querySelector('span');
    for (let i = 0; i < 3; i++) wrap.appendChild(seed.cloneNode(true));
    const many = measure(tr);
    wrap.querySelectorAll(':scope > span:nth-child(n+2)').forEach((n) => n.remove());
    return { one, many };
  });
  if (!inset) {
    failures.push('breaks: no stamped row to measure, the gap check has nothing to say');
  } else {
    console.log(`stamp gap  1=${inset.one.worst}px in ${inset.one.row}px  4=${inset.many.worst}px in ${inset.many.row}px`);
    if (inset.many.worst < 4)
      failures.push(`breaks: a four-stamp row leaves only ${inset.many.worst}px above and below the pills, stacked rows touch`);
  }

  // The stamp carries its own length now: "start - end (Nm)". Read as a shape, so a
  // missing or non-minute duration gets named rather than eyeballed.
  const stamp = await page.evaluate(
    () => document.querySelector('main tbody td > .flex-col > span')?.innerText.trim() ?? null
  );
  console.log(`stamp    ${stamp}`);
  if (!stamp) failures.push('breaks: no stamp to read the duration from');
  else if (!/^\d{2}:\d{2}:\d{2} - \d{2}:\d{2}:\d{2} \(\d+m\)$/.test(stamp))
    failures.push(`breaks: the stamp reads "${stamp}", expected "start - end (Nm)"`);

  // No field should fall back to the raw 2px accent ring the base layer puts on the
  // page; each one owns a quieter focus paint. This is how the break-threshold box
  // was found — a bare input, so it took the ring instead. Swept per view below.
  }
  await shot(page, `${OUT}/interactions.png`, { clip: { x: 0, y: 0, width: VIEWPORT.width, height: 700 } });
}

// Both halves of the focus contract, on every field in every view: nothing may fall
// back to the raw 2px accent ring the base layer puts on the page, and nothing may
// switch that ring off without putting its own paint in its place. The break
// threshold box is the field that failed the first half — a bare input, so it took
// the ring while every .field next to it repaints its border.
async function checkRings(view) {
  const r = await page.evaluate(() => {
    const snap = (n) => {
      const c = getComputedStyle(n);
      return `${c.borderTopColor}|${c.boxShadow}|${c.backgroundColor}`;
    };
    const bare = [];
    const silent = [];
    let n = 0;
    for (const el of document.querySelectorAll('main input, main select, main textarea')) {
      if (!el.offsetParent) continue;
      n++;
      const name =
        el.getAttribute('aria-label') || el.placeholder || `${el.tagName.toLowerCase()}:${el.type || ''}`;
      // The paint may live on the group the field lights up instead, so the host
      // counts as an answer too.
      const host = el.closest('label, div');
      const rest = snap(el);
      const restHost = host ? snap(host) : null;
      el.focus();
      const cs = getComputedStyle(el);
      if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) {
        bare.push(`${name} ${cs.outlineWidth} ${cs.outlineColor}`);
      }
      const painted = snap(el) !== rest || (host && snap(host) !== restHost);
      if (!painted) silent.push(name);
      el.blur();
    }
    return { n, bare, silent };
  });
  console.log(
    `focus ${view.padEnd(10)} fields=${r.n} bare=${r.bare.length} silent=${r.silent.length}` +
      (r.bare.length ? ` -> ${r.bare.join(' | ')}` : '') +
      (r.silent.length ? ` !! ${r.silent.join(' | ')}` : '')
  );
  if (r.bare.length) failures.push(`focus [${view}]: ${r.bare.join(', ')} take the raw accent outline instead of their own paint`);
  if (r.silent.length) failures.push(`focus [${view}]: ${r.silent.join(', ')} repaint nothing when focused, the keyboard caret is invisible`);
}

// The floating bar, plus the two data actions that now live in the sidebar. The bar must
// stay detached from the viewport and hold its offset while the page scrolls; the buttons
// carry colour from the active scheme, so their text has to clear AA in all six, not just
// the default.
async function checkChrome() {
  const bar = page.locator('header.no-print');
  const gaps = await bar.evaluate((el) => ({
    top: Math.round(el.getBoundingClientRect().top),
    left: Math.round(el.getBoundingClientRect().left),
    right: Math.round(window.innerWidth - el.getBoundingClientRect().right),
    radius: getComputedStyle(el).borderTopLeftRadius,
    lifted: getComputedStyle(el).boxShadow !== 'none',
    clearance: Math.round(document.querySelector('main .no-print').getBoundingClientRect().top - el.getBoundingClientRect().bottom)
  }));
  console.log(
    `float    top=${gaps.top}px left=${gaps.left}px right=${gaps.right}px radius=${gaps.radius} shadow=${gaps.lifted} clearance=${gaps.clearance}px`
  );
  if (gaps.top < 8 || gaps.left < 8 || gaps.right < 8) {
    failures.push(`float: the bar is still touching an edge (${gaps.top}/${gaps.left}/${gaps.right}px gaps)`);
  }
  if (gaps.radius === '0px' || !gaps.lifted) failures.push('float: no radius or shadow, so the bar does not read as lifted');
  if (gaps.clearance < 0) failures.push(`float: the bar overlaps the strip below it by ${-gaps.clearance}px`);

  await page.evaluate(() => window.scrollTo(0, 19));
  const stuck = await bar.evaluate((el) => Math.round(el.getBoundingClientRect().top));
  if (Math.abs(stuck - gaps.top) > 1) failures.push(`float: the bar drifts to ${stuck}px while stuck, it sits at ${gaps.top}px`);
  await page.evaluate(() => window.scrollTo(0, 0));

  const inline = await page.evaluate(() => document.documentElement.getAttribute('style'));
  // Located by the words on the control, not by a `title=` it no longer carries —
  // the native tooltip became a real one, and a selector that leaned on it would
  // have silently started measuring the view-switcher buttons instead. Basalt puts
  // the data actions in the bar at every width, so they are measured there now.
  const buttons = {
    upload: { sel: 'header.no-print label' },
    export: { sel: 'header.no-print button', text: 'Export' }
  };
  await press('1');
  // Two metrics carry a hue of their own. Which nth-child a column is depends on how
  // many are hidden, so resolve each from its header rather than hardcode a position.
  const HUES = [
    { key: 'half', head: 'half', role: 'throughput', cell: (c) => `main tbody tr td:nth-child(${c}) input` },
    { key: 'rate', head: 'calls/hr', role: 'warning', cell: (c) => `main tbody tr td:nth-child(${c}) span` }
  ];
  for (const h of HUES) {
    h.col = await page.evaluate((head) =>
      [...document.querySelectorAll('main thead th')].findIndex((th) => th.innerText.trim().toLowerCase() === head) + 1, h.head);
    if (h.col < 1) failures.push(`hue: no "${h.head}" column on the rundown, nothing to measure`);
    else buttons[h.key] = h.cell(h.col);
  }
  for (const [id, mode] of Object.entries(COLOR_MODES)) {
    await page.evaluate(
      (vars) => vars.forEach(([name, triplet]) => document.documentElement.style.setProperty(name, triplet)),
      Object.entries(mode.colors).map(([role, hex]) => [cssVarName(role), hexToRgbTriplet(hex)])
    );
    // The header's action buttons carry `transition-colors`, so a read taken on the
    // paint's own tick returns the colour they are leaving, not the one they reached.
    await page.waitForTimeout(260);
    const parts = [];
    for (const [key, sel] of Object.entries(buttons)) {
      const r = await read(sel);
      if (!r) {
        parts.push(`${key}=MISSING`);
        failures.push(`contrast: ${id} has no "${key}" button to measure`);
        continue;
      }
      const cr = between(r.text, fillOf(r));
      parts.push(`${key}=${cr.toFixed(1)}:1`);
      if (cr < 4.5) failures.push(`contrast: ${id}/${key} label "${r.label}" is ${cr.toFixed(2)}:1, below AA 4.5`);
    }
    // AA above covers legibility; this covers the colour itself, which is the part
    // that silently reverts when a cell stops resolving through its role.
    const hues = await page.evaluate((want) => {
      const role = (name) => {
        const p = document.createElement('span');
        p.style.color = `rgb(var(--k-${name}))`;
        document.body.appendChild(p);
        const v = getComputedStyle(p).color;
        p.remove();
        return v;
      };
      return want.map((w) => {
        const el = document.querySelector(w.sel);
        return { key: w.key, got: el ? getComputedStyle(el).color : null, want: role(w.role) };
      });
    }, HUES.filter((h) => h.col > 0).map((h) => ({ key: h.key, sel: h.cell(h.col), role: h.role })));
    for (const h of hues) {
      if (!h.got) failures.push(`hue: no ${h.key} cell to read in ${id}`);
      else if (h.got !== h.want) failures.push(`hue: in ${id} ${h.key} reads ${h.got}, not its role's ${h.want}`);
    }
    const bar = await read('header.no-print');
    const card = await read('main .panel, main .panel.lift');
    let level = 'no-card';
    if (bar && card) {
      const sep = between(fillOf(bar), fillOf(card));
      level = `bar-vs-card=${sep.toFixed(2)}`;
      if (sep < 1.15) {
        failures.push(`layering: in ${id} the bar and the content cards differ by only ${sep.toFixed(2)}x, the bar is not distinguishable`);
      }
    }
    console.log(`contrast ${id.padEnd(11)} ${parts.join('  ')}  ${level}`);
  }
  await page.evaluate((style) => document.documentElement.setAttribute('style', style ?? ''), inline);
  await shot(page, `${OUT}/float-bar.png`, { clip: { x: 0, y: 0, width: VIEWPORT.width, height: 200 } });
}

// Topmost-element probe: elementFromPoint returns whatever the browser would hit.
// A point inside the menu that resolves outside it means something paints over it.
async function probe(menu, view, label) {
  const r = await menu.evaluate((el) => {
    const b = el.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  });
  if (r.w < 40 || r.h < 40) {
    failures.push(`${view}: "${label}" menu is ${Math.round(r.w)}x${Math.round(r.h)}, nothing to test`);
    return;
  }
  if (r.y + r.h > VIEWPORT.height + 1 || r.x + r.w > VIEWPORT.width + 1 || r.y < 0 || r.x < 0) {
    failures.push(`${view}: "${label}" menu escapes the viewport at ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.w)}x${Math.round(r.h)}`);
  }
  const buried = await menu.evaluate((el) => {
    const b = el.getBoundingClientRect();
    const out = [];
    for (const [fx, fy] of [[0.5, 0.06], [0.5, 0.5], [0.5, 0.94], [0.08, 0.5], [0.92, 0.5]]) {
      const x = Math.round(b.left + b.width * fx);
      const y = Math.round(b.top + b.height * fy);
      if (x < 1 || y < 1 || x > innerWidth - 1 || y > innerHeight - 1) continue;
      const hit = document.elementFromPoint(x, y);
      if (!el.contains(hit)) {
        out.push(`${x},${y} by ${hit?.tagName}.${(hit?.className || '').toString().slice(0, 60)}`);
      }
    }
    return out;
  });
  if (!buried.length) return;
  buried.forEach((b) => failures.push(`${view}: "${label}" menu buried at ${b}`));
}

async function checkPopovers(view) {
  const total = await page.locator('[aria-expanded]').count();
  for (let i = 0; i < total; i++) {
    const trigger = page.locator('[aria-expanded]').nth(i);
    if (!(await trigger.isVisible())) continue;
    const label = ((await trigger.innerText()) || '').replace(/\s+/g, ' ').trim().slice(0, 22) || `trigger${i}`;
    await trigger.click();
    // A backdrop-filter layer can miss the first frame, so let the pop-down settle.
    await page.waitForTimeout(250);
    if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
      failures.push(`${view}: "${label}" did not open`);
      continue;
    }
    const menu = page.locator('.menu');
    if ((await menu.count()) === 0) {
      failures.push(`${view}: "${label}" opened with no .menu in the DOM`);
      continue;
    }
    await probe(menu.last(), view, label);
    await shot(page, `${OUT}/${view}--${label.replace(/[^\w-]+/g, '-')}.png`);
    await press('Escape', 120);
  }
}

// Elevation has to come from somewhere, and the two modes buy it in different currency.
// DARK has room at the bottom of the scale: page -> card is a real lightness step, so a
// plate separates before its edge is even drawn. LIGHT has none — #FAFAF8 under a #FFFFFF
// card is 1.8 L*, and that pair is the design, not an accident; widening it means a grey
// page. So light is policed on its hairline instead, which is what actually draws a plate
// there. Both floors are asserted, and the live document is read back so a palette edit
// that never reached the DOM cannot pass.
async function checkLayers() {
  const L = (hex) => toLab(toRgbArr(hex))[0];
  for (const [id, mode] of Object.entries(COLOR_MODES)) {
    const c = mode.colors;
    const plate = L(c.surface) - L(c.page);
    const edge = Math.abs(L(c.surface) - L(c.hairline));
    const floor = id === 'light' ? 1 : 4;
    console.log(`layers ${id.padEnd(6)} plate-vs-page dL*=${plate.toFixed(1)} (floor ${floor}) hairline-vs-plate dL*=${edge.toFixed(1)}`);
    if (plate < floor) failures.push(`layers [${id}]: a card sits only ${plate.toFixed(1)} L* above the page, below the ${floor} this mode has to earn its elevation from`);
    if (edge < 8) failures.push(`layers [${id}]: the hairline is only ${edge.toFixed(1)} L* from the card, so a plate edge barely paints`);
  }
  const live = await page.evaluate(() => {
    const g = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    return { mode: document.documentElement.dataset.mode, page: g('--k-page'), surface: g('--k-surface') };
  });
  const want = COLOR_MODES[live.mode];
  if (!want) failures.push(`layers: <html data-mode="${live.mode}"> is not a mode`);
  else {
    for (const role of ['page', 'surface']) {
      const got = live[role];
      const exp = hexToRgbTriplet(want.colors[role]);
      if (got !== exp) failures.push(`layers: --k-${role} reads "${got}", the active ${live.mode} palette says "${exp}"`);
    }
  }
}

// The complaint was that a search bar never answered the pointer. Hover only has
// something to say while the field is not focused, so that is the state measured.
async function checkFieldHover() {
  for (const [key, view] of TABLE_VIEWS) {
    await press(key);
    const field = page.locator('main input[type="search"]').first();
    if (!(await field.count())) {
      failures.push(`hover [${view}]: the toolbar has no search field to measure`);
      continue;
    }
    // The wash lands in `background-image` by design: a field that swaps its opaque
    // sunken fill for a translucent tint reads inverted.
    await hoverMoves(field, view, { edge: 'borderTopColor', wash: 'backgroundImage', shadow: 'boxShadow', color: 'color' });
    await page.mouse.move(4, 4);
    await page.waitForTimeout(120);
  }
}

// The rundown toolbar is one flex line that wraps the moment its children outgrow the
// panel, and how wide those children are is data-dependent: "20/20" becomes "120/120",
// a wider name list, a longer date. So measure the line instead of trusting the width
// classes — one row, slack still left for the badges to grow into, and neither field
// so narrow it clips what it has to show.
async function checkToolbarFits() {
  await press('1');
  const m = await page.evaluate(() => {
    const bar = document.querySelector('main .panel');
    const cs = getComputedStyle(bar);
    const kids = [...bar.children];
    const pad = (side) => parseFloat(cs[`padding${side}`]);
    const inner = bar.clientWidth - pad('Left') - pad('Right');
    const used = kids.reduce((n, k) => n + k.getBoundingClientRect().width, 0) + (kids.length - 1) * parseFloat(cs.gap);
    const heights = kids.map((k) => k.getBoundingClientRect().height);
    const tallest = Math.max(...heights);
    const gap = parseFloat(cs.gap);
    const contentH = bar.clientHeight - pad('Top') - pad('Bottom');
    const textWidth = (el, text) => {
      const s = getComputedStyle(el);
      const probe = document.createElement('span');
      for (const p of ['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'fontVariantNumeric']) probe.style[p] = s[p];
      probe.textContent = text;
      document.body.append(probe);
      const w = probe.getBoundingClientRect().width;
      probe.remove();
      return Math.round(w) + 2;
    };
    const room = (el) => {
      const s = getComputedStyle(el);
      return Math.round(el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight));
    };
    const search = bar.querySelector('input[type="search"]');
    const thresh = bar.querySelector('input[inputmode="numeric"]');
    // Every control in this row is one height, so a mismatch reads as a typo in the
    // markup rather than as design. Nothing enforces it: each control derives its box
    // from its own padding, and one of them derived it from a nested number input
    // instead, which made it 5px taller than its neighbours.
    const name = (el) => (el.textContent || '').trim().slice(0, 12) || el.getAttribute('aria-label') || '?';
    return {
      rows: Math.round((contentH + gap) / (tallest + gap)),
      slack: Math.round(inner - used),
      h: {
        min: Math.round(Math.min(...heights)),
        max: Math.round(Math.max(...heights)),
        tall: name(kids[heights.indexOf(Math.max(...heights))]),
        short: name(kids[heights.indexOf(Math.min(...heights))])
      },
      search: { need: textWidth(search, search.placeholder), room: room(search) },
      // The stepper overlay sits on top of the field's right edge, so its width comes
      // off the room the digits actually have.
      thresh: { need: textWidth(thresh, '120') + 13, room: room(thresh) }
    };
  });
  // One row is the design at 1440 now that the dock owns 72px rather than the old
  // 288px sidebar, but the badges grow with the data, so the ceiling is two rows; the
  // slack figure is reported, not asserted, because a wrapped row has no single width
  // to measure.
  console.log(
    `fit rundown  rows=${m.rows} slack=${m.slack}px h=${m.h.min}..${m.h.max} search=${m.search.need}/${m.search.room} thresh=${m.thresh.need}/${m.thresh.room}`
  );
  if (m.rows > 2) failures.push(`fit [rundown]: the toolbar wrapped to ${m.rows} rows, a control is too wide`);
  if (m.h.max - m.h.min > 1) {
    failures.push(`fit [rundown]: the toolbar controls are not one height — "${m.h.tall}" is ${m.h.max}px while "${m.h.short}" is ${m.h.min}px, so the row looks uneven`);
  }
  for (const [name, box] of [['search', m.search], ['threshold', m.thresh]]) {
    if (box.need > box.room) failures.push(`fit [rundown]: the ${name} field clips its value, needs ${box.need}px in ${box.room}px`);
  }
}

// The segmented control is the one widget in these rows whose box is not its own: the
// track adds padding around a thumb, so the group's height comes from a number nobody
// reads as a height, and it silently grew 2px shorter than every control beside it on
// all four toolbars at once. Chips and captions are text, not controls, so they are
// excluded by the 24px floor.
async function checkControlHeights() {
  for (const [key, name] of VIEWS) {
    await press(key);
    const rows = await page.evaluate(() =>
      [...document.querySelectorAll('main [role="group"], header [role="group"]')].map((g) => {
        const sibs = [...g.parentElement.children].filter((c) => c.getBoundingClientRect().height >= 24);
        return {
          label: g.getAttribute('aria-label'),
          got: Math.round(g.getBoundingClientRect().height),
          want: Math.round(Math.max(...sibs.map((c) => c.getBoundingClientRect().height)))
        };
      })
    );
    for (const r of rows) {
      if (Math.abs(r.got - r.want) > 1) {
        failures.push(`sizes [${name}]: the ${r.label} switch is ${r.got}px tall while the tallest control in its row is ${r.want}px`);
      }
    }
  }
  await press('1');
}

// A switch that only swaps the text in place reads as a freeze, and a chart that snaps to
// its new numbers reads as a screenshot. Both have to move — and "move" is measured as how
// long the page stays displaced, not how far: a ramp clamped to 1ms still travels the whole
// height of the view, in a single frame, and reads as nothing at all.
async function checkMotion() {
  // Sampled from inside the page on animation frames: a round trip per sample is slower than
  // the ramp itself, so measuring from outside only ever catches a settled page.
  const displaced = (pg) =>
    pg.evaluate(
      () =>
        new Promise((done) => {
          let first = 0, last = 0, px = 0, nodes = 0, name = 'none', ms = 0;
          let barLo = Infinity, barHi = -Infinity;
          const t0 = performance.now();
          const poll = () => {
            const now = performance.now() - t0;
            // The chrome has to stay put: a displaced page grows the document, the browser
            // clamps the scroll offset to it, and the sticky bar rides that out of the window.
            const bar = document.querySelector('header.app-bar')?.getBoundingClientRect().top;
            if (bar !== undefined) {
              barLo = Math.min(barLo, bar);
              barHi = Math.max(barHi, bar);
            }
            const found = [...document.querySelectorAll('main .animate__animated')];
            nodes = Math.max(nodes, found.length);
            for (const el of found) {
              const cs = getComputedStyle(el);
              if (cs.animationName !== 'none') {
                name = cs.animationName;
                ms = Math.round(parseFloat(cs.animationDuration) * 1000);
              }
              const y = Math.abs(new DOMMatrix(cs.transform).m42);
              if (y > 40) {
                if (!first) first = now;
                last = now;
              }
              px = Math.max(px, y);
            }
            if (now < 1600) requestAnimationFrame(poll);
            else
              done({
                px: Math.round(px),
                held: Math.round(last - first),
                nodes,
                name,
                ms,
                barLo: Math.round(barLo),
                barHi: Math.round(barHi)
              });
          };
          poll();
        })
    );

  // The key press has to come from Node, so the sampler starts first and the switch lands
  // while the page is already being watched.
  const sweep = async (pg, key) => {
    const watching = displaced(pg);
    await pg.keyboard.press(key);
    return watching;
  };

  await press('1');
  const enter = await sweep(page, '2');
  console.log(
    `motion view    ${enter.name} ${enter.ms}ms, ${enter.px}px held ${enter.held}ms over ${enter.nodes} nodes`
  );
  if (enter.name === 'none' || enter.ms < 200)
    failures.push(`motion: the switch ramps "${enter.name}" ${enter.ms}ms, so it reads as a silent text swap`);
  if (enter.held < 150)
    failures.push(`motion: the switch stays displaced for ${enter.held}ms, which reads as a snap, not a sweep`);
  if (enter.nodes < 2)
    failures.push(`motion: only ${enter.nodes} nodes ride the sweep, so the heading sits still while the view moves`);

  // The direction belongs to the rail, not to the page: forward through the views lifts the
  // next one from below, back through them drops the previous one from above. A switch that
  // always travels the same way reads as a page that ignores where you came from.
  const back = await sweep(page, '1');
  console.log(`motion return  ${back.name} ${back.ms}ms, held ${back.held}ms`);
  if (enter.name !== 'slideInUp')
    failures.push(`motion: 1→2 ramped "${enter.name}", so a forward switch does not rise from below`);
  if (back.name !== 'slideInDown')
    failures.push(`motion: 2→1 ramped "${back.name}", so a backward switch does not drop from above`);
  for (const [leg, s] of [['1→2', enter], ['2→1', back]]) {
    console.log(`motion bar     ${leg} stays ${s.barLo}→${s.barHi}px`);
    if (s.barHi - s.barLo > 1)
      failures.push(
        `motion: the app bar moves ${s.barLo}→${s.barHi}px on the ${leg} switch, so the header flickers as the page grows the document under it`
      );
  }

  // The spill only bites when the incoming page is the taller one: its displaced height
  // lengthens the scroll range, the browser re-anchors the scroll offset to keep something
  // steady under the eyes, and the sticky bar rides that out of the window. Switching from
  // raw CDR, which fits, into settings, which does not, is the one pair that does it.
  await press('2');
  const taller = await sweep(page, '5');
  console.log(`motion bar     2→5 stays ${taller.barLo}→${taller.barHi}px`);
  if (taller.barHi - taller.barLo > 1)
    failures.push(
      `motion: switching into a taller view moved the app bar ${taller.barLo}→${taller.barHi}px, so the header flickers`
    );

  // The canvas has to carry ink, not merely exist — an empty plot with a mounted <Bar> is
  // what this caught once. Measured once the route has settled: the analytics charts draw at
  // duration 0 (see AnalyticsView), so the promise is a painted picture, not a ramp.
  await press('3', 1200);
  const ink = await page.evaluate(() => {
    const c = document.querySelector('main canvas');
    if (!c) return -1;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
    return n;
  });
  console.log(`chart paint    ${ink} lit px`);
  if (ink < 2000)
    failures.push(`chart: the lead plot paints ${ink} px, so the canvas is blank or the data never reached it`);
  // The failure that hid this feature for three rounds: a browser reporting reduced motion
  // clamps every ramp to about a millisecond — animate.css pins `.animate__animated`, our own
  // stylesheet pins `*` — so the sweep is a single frame and no amount of travel is visible.
  // The clamp has to hold, and Settings' Motion opt-in has to lift it.
  const ctx = await browser.newContext({ viewport: VIEWPORT, colorScheme: DEFAULT_MODE, reducedMotion: 'reduce' });
  await signIn(ctx);
  const pg = await ctx.newPage();
  await pg.goto(BASE, { waitUntil: 'load' });
  await pg.waitForSelector('main h2');
  await pg.waitForTimeout(600);
  const clamped = await sweep(pg, '2');
  await pg.evaluate(() => {
    document.documentElement.dataset.motion = 'full';
  });
  const opted = await sweep(pg, '3');
  await ctx.close();
  console.log(
    `motion reduce  ${clamped.ms}ms held ${clamped.held}ms · opt-in ${opted.ms}ms held ${opted.held}ms`
  );
  if (clamped.held > 60)
    failures.push(`motion: reduced motion sweeps for ${clamped.held}ms, so the OS flag is ignored`);
  if (opted.held < 150)
    failures.push(`motion: the Motion opt-in sweeps for only ${opted.held}ms, so it cannot be overridden`);
  await press('1');
}

// A `hoverable` control takes its edge and wash from --tone, which falls back
// to the accent. So a control with a coloured icon has to declare the same tone or
// hovering it lights the wrong hue — the popovers get this from FilterPopover, and
// Print is the one control that sets it by hand.
async function checkPrintTone() {
  await press('1');
  const btn = page.getByRole('button', { name: 'Print', exact: true });
  if (!(await btn.count())) {
    failures.push('print: the rundown toolbar has no Print button');
    return;
  }
  const icon = await btn.locator('svg').evaluate((el) => getComputedStyle(el).color);
  await btn.hover();
  await page.waitForTimeout(200);
  const edge = await btn.evaluate((el) => getComputedStyle(el).borderTopColor);
  await page.mouse.move(4, 4);
  const tri = (s) => chan(s).join(',');
  console.log(`print tone   icon=${tri(icon)} hover=${tri(edge)}`);
  if (tri(icon) !== tri(edge)) {
    failures.push(`print: the icon is rgb(${tri(icon)}) but hovering lights it rgb(${tri(edge)})`);
  }
}

// Print is a third palette, hand-maintained, and an undeclared role does not fall back
// to paper white — it falls back to whatever the *screen* mode painted. That is how
// `warning` went missing: calls/hr printed dark amber on white at ~1.9:1, in both modes,
// and no screenshot of the app on screen could ever have shown it. So half of this check
// is static, and the other half reaches the one thing a stylesheet cannot: the canvas
// bitmaps, which bake their colours at render time.
async function checkPrint() {
  const block = readFileSync('src/index.css', 'utf8').split('@media print')[1]?.match(/:root\s*\{([^}]*)\}/)?.[1];
  if (!block) {
    failures.push('print: src/index.css has no `@media print { :root { … } }` block');
    return;
  }
  const declared = new Set([...block.matchAll(/--k-([a-z-]+)\s*:/g)].map((m) => m[1]));
  for (const role of Object.keys(COLOR_MODES[DEFAULT_MODE].colors)) {
    if (!declared.has(role)) {
      failures.push(`print: --k-${role} is not set on paper, so it prints in its screen colour`);
    }
  }
  for (const role of declared) {
    if (!Object.keys(COLOR_MODES[DEFAULT_MODE].colors).includes(role)) {
      failures.push(`print: --k-${role} is overridden on paper but no mode declares it any more`);
    }
  }

  await press('3', 1200);
  const screen = await bitmapLum();
  if (screen === null) failures.push('print: the analytics view rendered no canvas to measure');

  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(500);
  const printed = await bitmapLum();
  // The table-only assertions run on the rundown view, because analytics has no
  // <thead> or scroll-capped container to measure and a null here would read as a pass.
  await press('1');
  const paper = await page.evaluate(() => ({
    mode: document.documentElement.getAttribute('data-mode'),
    warning: getComputedStyle(document.documentElement).getPropertyValue('--k-warning').trim(),
    hidden: getComputedStyle(document.querySelector('header.no-print')).display === 'none',
    clipped: [...document.querySelectorAll('main [class*="max-h"]')].some((el) => getComputedStyle(el).maxHeight !== 'none'),
    room: (() => {
      const r = document.querySelector('main .report-region');
      return r ? Math.round(r.scrollHeight - r.clientHeight) : -1;
    })(),
    head: getComputedStyle(document.querySelector('thead')).display
  }));

  await page.emulateMedia({ media: null });
  await page.waitForTimeout(500);
  const restored = await page.evaluate(() => document.documentElement.getAttribute('data-mode'));

  console.log(`print        roles=${declared.size} mode=${paper.mode} warning=(${paper.warning}) screenL=${screen?.toFixed(3)} paperL=${printed?.toFixed(3)} spill=${paper.room}px`);
  if (paper.mode !== 'light') failures.push(`print: the mode did not flip to light for paper, it is "${paper.mode}" — the chart canvases print their screen palette`);
  if (!/^\d+\s+\d+\s+\d+$/.test(paper.warning)) failures.push(`print: --k-warning does not resolve on paper, got "${paper.warning}"`);
  if (!paper.hidden) failures.push('print: a .no-print control is still on the page');
  if (paper.clipped) failures.push('print: a scroll container still caps its height, so rows past the fold are lost');
  if (paper.room < 0) failures.push('print: the rundown rendered no report region, so its height on paper is unproven');
  else if (paper.room > 0) failures.push(`print: the report region still hides ${paper.room}px of rows on paper, so the screen fill carried over to it`);
  if (paper.head !== 'table-header-group') failures.push(`print: thead computes to ${paper.head}, so the column labels do not repeat across pages`);
  if (screen !== null && printed !== null) {
    if (printed > 0.2) {
      failures.push(`print: the chart ink is still rgb-light on paper (mean L ${printed.toFixed(3)}) — it was painted for a dark screen and will vanish on white`);
    } else if (printed >= screen) {
      failures.push(`print: the analytics bitmap did not darken for paper (${screen.toFixed(3)} -> ${printed.toFixed(3)})`);
    }
  }
  if (restored !== DEFAULT_MODE) failures.push(`print: after the dialog closed the mode stayed "${restored}" instead of returning to ${DEFAULT_MODE}`);
}

// The export menu is the one feature that hands data to something outside the browser, so
// a silent throw reads as "the file never arrived". Assert each item actually downloads,
// with the extension its label promises. It runs from Settings on purpose: the menu lives
// in the sidebar now, so it must not need the rundown on screen to produce a file.
async function checkExports() {
  await press('5');
  await page.getByRole('button', { name: /Export/ }).click();
  for (const [label, ext] of [
    ['Excel', '.xlsx'],
    ['CSV', '.csv'],
    ['JSON', '.json']
  ]) {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: label, exact: true }).click()
    ]);
    const name = download.suggestedFilename();
    console.log(`export       ${ext.padEnd(5)} ${name}`);
    if (!name.endsWith(ext)) failures.push(`export: "${label}" downloaded "${name}", not a ${ext} file`);
  }
  await press('Escape', 200);
}

// The range used to be two native <input type="date">: system chrome the two modes
// cannot reach, and free to land on a date the file has no rows for. So assert the
// browser picker is gone, the panel that replaced it clears the toolbar under it, and
// the grid offers exactly the dates the data carries.
async function checkCalendar() {
  await press('1');
  await page.getByRole('button', { name: 'Custom', exact: true }).click();
  await page.waitForTimeout(250);
  const native = await page.locator('input[type="date"]').count();
  if (native) failures.push(`calendar: ${native} native date input(s) left in the page`);

  // Found by where it sits, not by what it reads: the label is a range that the
  // picker rewrites mid-assertion, and the separator between its halves is copy,
  // not structure. The custom-range group is the only one with a "reset" beside it.
  const trigger = page
    .locator('main div:has(> button:text-is("reset")) button[aria-expanded]')
    .first();
  if (!(await trigger.count())) {
    failures.push('calendar: the title row has no range trigger');
    return;
  }
  const menu = await openMenu(trigger, 250);
  const box = await menu.boundingBox();
  if (!box) {
    failures.push('calendar: the range trigger never opened a panel');
    return;
  }
  const onTop = await page.evaluate(
    ([x, y]) => {
      const hit = document.elementFromPoint(x, y);
      return !!hit && !!hit.closest('.menu');
    },
    [box.x + box.width / 2, box.y + box.height / 2]
  );
  if (!onTop) failures.push('calendar: the panel opens behind the toolbar under it');
  await shot(page, `${OUT}/calendar.png`, { clip: box });

  const cells = await menu.locator('button[aria-label^="20"]').evaluateAll((els) =>
    els.map((e) => ({ iso: e.getAttribute('aria-label'), off: e.disabled }))
  );
  const live = cells.filter((c) => !c.off).map((c) => c.iso);
  const total = await textNum(/^(\d+) of \d+ dates$/);
  // A file that fits in one month must not be able to page into an empty one.
  const months = new Set(live.map((iso) => iso.slice(0, 7)));
  const nav = await menu.locator('button[aria-label$="month"]').evaluateAll((els) => els.map((e) => e.disabled));
  if (months.size === 1 && nav.length === 2 && nav.some((disabled) => !disabled)) {
    failures.push('calendar: the month nav still reaches months the file has no data for');
  }
  if (!live.length) {
    failures.push(`calendar: no day in the visible month is selectable, ${total} dates are unreachable`);
    return;
  }
  console.log(`calendar       live=${live.length} of ${cells.length} cells ${live[0]}..${live[live.length - 1]} navOff=${nav.filter(Boolean).length}`);

  await menu.getByRole('button', { name: live[0], exact: true }).click();
  await page.waitForTimeout(200);
  await menu.getByRole('button', { name: live[live.length - 1], exact: true }).click();
  await page.waitForTimeout(300);
  const label = (await trigger.innerText()).replace(/\s+/g, ' ').trim();
  const inRange = await textNum(/^(\d+) of \d+ dates$/);
  console.log(`calendar pick  "${label}" dates=${inRange}`);
  if (!label.includes(live[0]) || !label.includes(live[live.length - 1])) {
    failures.push(`calendar: picking ${live[0]} then ${live[live.length - 1]} left the trigger reading "${label}"`);
  }
  if (inRange < 1) failures.push(`calendar: the range you picked selects ${inRange} dates`);
  // Put the range back. Everything measured after this point expects the whole dataset,
  // and a Custom pick left here shrinks their tables without saying so — the sweep used
  // to be rescued by the sample button resetting the range on its way past.
  await press('Escape', 200);
  await page.locator('main').getByRole('button', { name: 'All', exact: true }).first().click();
  await page.waitForTimeout(250);
}

// The raw CDR report gained the rundown's extension filter. Selecting none has to
// actually empty the table, or the control is decoration.
async function checkRawCdrFilter() {
  await press('2');
  const readChips = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('main .panel span')]
        .filter((s) => /^\d+ (calls|answered)$/.test((s.textContent || '').trim()))
        .map((s) => ({ text: s.textContent.trim(), color: getComputedStyle(s).color }))
    );
  const chips = await readChips();
  const hues = new Set(chips.map((c) => c.color));
  console.log(`chips rawCdr   ${chips.map((c) => `${c.text}=${c.color}`).join(' ') || 'none'}`);
  if (chips.length !== 2) {
    failures.push(`chips [rawCdr]: ${chips.length} of the two count chips are in the toolbar`);
  }
  if (hues.size < 2) {
    failures.push(`chips [rawCdr]: the chips resolve to ${hues.size} colour, so they read as one grey line`);
  }
  // The row count comes from the pager rather than a toolbar chip, so the filter is
  // measured against the table it actually drives.
  const shown = () => textNum(/^\d+ to \d+ of (\d+)$/);
  const trigger = page.locator('main button[aria-expanded]').filter({ hasText: /^Agents/ }).first();
  if (!(await trigger.count())) {
    failures.push('rawCdr: the toolbar has no Agents filter, extension filtering never landed here');
    return;
  }
  const before = await shown();
  const menu = await openMenu(trigger, 280);
  const agents = await menu.locator('input[type="checkbox"]').count();
  const pick = (name) => menu.getByRole('button', { name, exact: true });
  let emptied = -1;
  let refilled = -1;
  if (agents === 0) {
    failures.push('rawCdr: the Agents filter lists no extensions');
  } else {
    await pick('None').click();
    await page.waitForTimeout(300);
    emptied = await shown();
    await pick('All').click();
    await page.waitForTimeout(300);
    refilled = await shown();
  }
  await press('Escape', 150);
  console.log(`rawCdr filter  agents=${agents} rows ${before} -> none:${emptied} -> all:${refilled}`);
  if (agents > 0 && emptied !== 0) {
    failures.push(`rawCdr: deselecting every agent still matches ${emptied} calls, the filter is not applied`);
  }
  if (before >= 0 && refilled >= 0 && refilled !== before) {
    failures.push(`rawCdr: re-selecting every agent matches ${refilled} calls, was ${before}`);
  }
}

// The sample file carries one shift date, so a multi-day rundown cannot be reached
// through it. Seed a three-day fixture into a throwaway context instead of relaxing
// the assertion to "whatever the demo happens to contain".
async function checkDayGroups() {
  const DAYS = ['2026-10-05', '2026-10-06', '2026-10-07'];
  // Day d carries d+1 agents, two calls each, so the bands read 1 / 2 / 3 agents.
  const records = DAYS.flatMap((day, d) =>
    ['1042', '1043', '1044'].slice(0, d + 1).flatMap((ext, i) =>
      [0, 1].map((c) => ({
        'CALL DATE (UTC)': `${day} 20:${String(15 + c * 30 + i).padStart(2, '0')}:00`,
        'END TIME (UTC)': `${day} 20:${String(25 + c * 30 + i).padStart(2, '0')}:00`,
        EXTENSION: ext,
        DIRECTION: 'OUT',
        RESPONSE: 'ANSWERED',
        DURATION: '600',
        REGION: 'North',
        CLID: '15596900000',
        DESTINATION: '1415000000'
      }))
    )
  );

  const ctx = await browser.newContext({ viewport: VIEWPORT });
  await signIn(ctx);
  // Records are server-side now, so the fixture is uploaded the way a person's export is
  // rather than seeded into this browser. Point the server at a scratch database first:
  //   DB_PATH=data/test.sqlite npm run dev
  // ctx.request carries the sign-in cookie; a bare fetch would not.
  const uploaded = await ctx.request.post(`${BASE}/api/calls`, {
    multipart: { file: { name: 'ui-check-days.csv', mimeType: 'text/csv', buffer: Buffer.from(Papa.unparse(records)) } }
  });
  if (!uploaded.ok()) {
    failures.push(`days: uploading the 3-day fixture failed with ${uploaded.status()} — ${await uploaded.text()}`);
    await ctx.close();
    return;
  }
  const p = await ctx.newPage();
  watch(p, ' [days]');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await press('1', 700, p);

  const bands = () => p.locator('main tbody tr td[colspan]').evaluateAll((tds) =>
    tds.map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())
  );
  const rowCount = () => p.evaluate(() => document.querySelectorAll('main tbody tr').length);

  const grouped = await bands();
  const flat = await rowCount();
  console.log(`day bands      ${grouped.length} bands · ${flat} rows :: ${grouped.join(' | ')}`);
  const want = ['2026-10-05 · 1 agent', '2026-10-06 · 2 agents', '2026-10-07 · 3 agents'];
  if (grouped.length !== 3) {
    failures.push(`days: a 3-shift range renders ${grouped.length} date bands, expected one per shift`);
  } else {
    grouped.forEach((text, i) => {
      if (text !== want[i]) {
        failures.push(`days: band ${i + 1} reads "${text}", expected "${want[i]}"`);
      }
    });
  }
  if (flat !== 9) failures.push(`days: the grouped table holds ${flat} rows, expected 6 agent-days + 3 bands`);

  // A sort must reorder inside the days, never scatter the days themselves.
  const callsHeader = p.getByRole('columnheader', { name: 'Calls', exact: true });
  await callsHeader.locator('button').click();
  await p.waitForTimeout(300);
  if ((await callsHeader.getAttribute('aria-sort')) === 'none') {
    failures.push('days: the Calls header never sorted, so the band order below proves nothing');
  }
  const afterSort = await bands();
  if (afterSort.join(' ') !== grouped.join(' ')) {
    failures.push(`days: sorting by Calls reordered the shifts: ${afterSort.join(' | ')}`);
  }
  await callsHeader.locator('button').click();
  await p.waitForTimeout(300);

  const trigger = p.locator('main button[aria-expanded]').filter({ hasText: /All dates|2026-10/ }).first();
  if (!(await trigger.count())) {
    failures.push('days: a multi-day range offers no way to scope the rundown to one shift');
    await ctx.close();
    return;
  }
  // The scope panel stays open after a pick, so every visit to it ends with a dismissal.
  const scopeTo = async (text) => {
    const menu = await openMenu(trigger, 250, p);
    await menu.locator('button', { hasText: text }).click();
    await p.waitForTimeout(350);
    await press('Escape', 150, p);
  };
  await shot(p, `${OUT}/rundown-days.png`, { fullPage: true });
  const menu = await openMenu(trigger, 250, p);
  const options = await menu.locator('button').evaluateAll((els) =>
    els.map((e) => ({ text: (e.textContent || '').replace(/\s+/g, ' ').trim(), pressed: e.getAttribute('aria-pressed') }))
  );
  console.log(`day scope      ${options.map((o) => `${o.text}${o.pressed === 'true' ? '*' : ''}`).join(' | ')}`);
  await shot(p, `${OUT}/rundown-day-scope.png`, { clip: await menu.boundingBox() });
  if (options.length !== 4) failures.push(`days: the scope menu lists ${options.length} options, expected All dates + 3 shifts`);

  await menu.locator('button', { hasText: '2026-10-06' }).click();
  await p.waitForTimeout(350);
  const scopedBands = await bands();
  const scopedRows = await rowCount();
  const label = (await trigger.innerText()).replace(/\s+/g, ' ').trim();
  console.log(`day scoped     "${label}" bands=${scopedBands.length} rows=${scopedRows}`);
  if (scopedBands.length) failures.push('days: scoping to one shift left the date bands in the table');
  if (scopedRows !== 2) failures.push(`days: 2026-10-06 has 2 agent-days, the table shows ${scopedRows} rows`);
  if (!label.includes('2026-10-06')) failures.push(`days: the scope control reads "${label}" after picking 2026-10-06`);

  await press('Escape', 150, p);
  if (await menu.count()) failures.push('days: Escape left the scope panel open');

  await scopeTo('All dates');
  if ((await bands()).length !== 3) failures.push('days: returning to All dates did not restore the per-shift bands');

  // Raw CDR: the same split over the call log.
  await press('2', 600, p);
  const rawBands = await bands();
  const rawRows = await rowCount();
  console.log(`raw bands      ${rawBands.length} bands · ${rawRows} rows :: ${rawBands.join(' | ')}`);
  const wantRaw = ['2026-10-05 · 2 calls', '2026-10-06 · 4 calls', '2026-10-07 · 6 calls'];
  if (rawBands.join(' | ') !== wantRaw.join(' | ')) {
    failures.push(`raw days: the bands read ${JSON.stringify(rawBands)}, expected ${JSON.stringify(wantRaw)}`);
  }
  if (rawRows !== 15) failures.push(`raw days: the list holds ${rawRows} rows, expected 12 calls + 3 bands`);
  await shot(p, `${OUT}/raw-days.png`, { fullPage: true });
  await scopeTo('2026-10-06');
  const rawScoped = await rowCount();
  if ((await bands()).length) failures.push('raw days: scoping to one shift left the bands in the list');
  if (rawScoped !== 4) failures.push(`raw days: 2026-10-06 holds 4 calls, the list shows ${rawScoped} rows`);
  await scopeTo('All dates');

  // Analytics: every chart and tile blends the shifts, so the scope has to reach the
  // aggregate too — otherwise the dropdown filters the table and lies about the rest.
  await press('3', 1000, p);
  const tile = (label) =>
    p.evaluate((text) => {
      const card = [...document.querySelectorAll('main .panel.lift')].find(
        (c) => (c.querySelector('.text-xs')?.textContent || '').trim() === text
      );
      return card ? (card.querySelector('.num')?.textContent || '').trim() : null;
    }, label);
  const note = (want = 'agent-days') =>
    p.evaluate((re) => {
      const span = [...document.querySelectorAll('main section header span')].find((s) =>
        new RegExp(re).test(s.textContent || '')
      );
      return span ? span.textContent.trim() : null;
    }, want);
  const allCalls = await tile('Calls');
  const allNote = await note();
  await scopeTo('2026-10-07');
  const oneCalls = await tile('Calls');
  const oneNote = await note();
  const regionNote = await note('region');
  await shot(p, `${OUT}/analytics-day-scope.png`, { fullPage: true });
  console.log(`analytics      calls ${allCalls} -> ${oneCalls} · "${allNote}" -> "${oneNote}" · region "${regionNote}"`);
  if (regionNote !== '1 region') failures.push(`analytics: the region chart is labelled "${regionNote}" for a single region`);
  if (allCalls !== '12') failures.push(`analytics: the Calls tile reads "${allCalls}" across the range, expected 12`);
  if (oneCalls !== '6') failures.push(`analytics: scoping to 2026-10-07 left the Calls tile at "${oneCalls}", expected 6`);
  if (allNote !== '6 agent-days') failures.push(`analytics: the volume chart is labelled "${allNote}", expected 6 agent-days`);
  if (oneNote !== '3 agent-days') failures.push(`analytics: scoping left the chart labelled "${oneNote}", expected 3 agent-days`);

  await ctx.close();

  // The fixture replaced the shared dataset on the server, and every check after this one
  // reads that same server. Put the seeded data back and let the main page pick it up, or
  // they measure a twelve-row table and report a scroll that isn't there.
  await page.request.post(`${BASE}/api/calls/demo`, { data: {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.keyboard.press('1');
  await page.waitForSelector('main tbody tr', { timeout: 20000 });
}

async function checkViewTitles() {
  const rows = await navRows();
  if (rows.length !== VIEWS.length) {
    failures.push(`titles: the sidebar lists ${rows.length} views, expected ${VIEWS.length}`);
    return;
  }
  let overlapped = 0;
  let shotBar = false;
  for (const { key, name } of rows) {
    await press(key);
    const t = await page.evaluate(() => {
      const h = document.querySelector('main h2');
      if (!h) return null;
      const box = h.getBoundingClientRect();
      return {
        text: h.textContent.trim(),
        painted: box.width > 20 && box.height > 10,
        desc: (h.parentElement.querySelector('p')?.textContent || '').trim()
      };
    });
    console.log(`title ${key}   ${t ? `${t.text} · ${t.painted ? 'painted' : 'hidden'} · ${t.desc.split(' ').length}w` : 'none'}`);
    if (!t) {
      failures.push(`titles [${name}]: main has no heading, the view never got a title`);
      continue;
    }
    if (t.text !== name) failures.push(`titles [${name}]: the page is titled "${t.text}", the sidebar calls it "${name}"`);
    if (!t.painted) failures.push(`titles [${name}]: the heading has no box, so it is not on screen`);
    if (t.desc.split(' ').length < 5) failures.push(`titles [${name}]: the subtitle is "${t.desc}", it explains nothing`);

    // The heading row and the floating app bar are both positioned, so if they sit at
    // the same depth DOM order decides it — and the heading comes later, which paints
    // "Rundown" straight through the brand text as you scroll.
    const stack = await page.evaluate(() => {
      const bar = document.querySelector('header.app-bar');
      const h = document.querySelector('main h2');
      if (!bar || !h) return null;
      const before = window.scrollY;
      const b = bar.getBoundingClientRect();
      window.scrollTo(0, before + (h.getBoundingClientRect().top - (b.top + b.height / 2)));
      const hb = h.getBoundingClientRect();
      const hit = document.elementFromPoint(hb.left + hb.width / 2, hb.top + hb.height / 2);
      return {
        overlap: hb.bottom > b.top && hb.top < b.bottom,
        inBar: !!hit && !!hit.closest('header.app-bar'),
        tag: hit ? hit.tagName.toLowerCase() : 'none'
      };
    });
    console.log(`stack ${key}    ${stack ? `${stack.overlap ? 'overlaps bar' : 'page too short'} · top=${stack.tag}` : 'n/a'}`);
    if (stack?.overlap && !shotBar) {
      shotBar = true;
      await shot(page, `${OUT}/title-under-bar.png`, { clip: { x: 0, y: 0, width: VIEWPORT.width, height: 110 } });
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    if (!stack) failures.push(`titles [${name}]: no floating bar or heading to stack-test`);
    else if (stack.overlap) {
      overlapped += 1;
      if (!stack.inBar)
        failures.push(`titles [${name}]: "${stack.tag}" paints over the floating app bar, so the heading collides with the brand text on scroll`);
    }
  }
  // Two of the five views are short enough that their heading never reaches the bar.
  // That is fine, but if none of them ever did the check above would be vacuous.
  if (!overlapped) failures.push('titles: no view heading ever slides behind the app bar, so the stacking check has nothing to test');
}

// The sidebar is the dock: 72px of icon, name and hotkey per view, and the dataset
// switcher with its facts one hover to the right. These are the assertions that would rot
// silently — labels present with no pointer, the panel not growing, no hover card, and the
// switcher actually re-pointing the dataset every browser reads.
async function checkSidebar() {
  await press('1');
  const rows = await navRows();
  if (rows.length !== VIEWS.length) {
    failures.push(`sidebar: ${rows.length} nav items, expected ${VIEWS.length}`);
    return;
  }
  const panel = page.locator('aside');
  const idle = (await panel.boundingBox()).width;
  // The floor is the dock's own width, not the old 288px column: what must not regress is
  // that the names are on the strip, which the row text check below measures directly.
  if (idle < 64) {
    failures.push(`sidebar: the dock is ${Math.round(idle)}px wide, that is icons and nothing else`);
  }
  // The panel is the app bar's twin: the same left inset, the same sunken fill, and
  // the same air above it as below. The gap is asserted rather than just "no overlap"
  // because the panel is pinned with a fixed offset while the bar's height is content
  // driven — a bar that grows eats the first view row, and a panel that only clears it
  // by 2px reads as jammed under it.
  const geo = await page.evaluate(() => {
    const bar = document.querySelector('header.app-bar').getBoundingClientRect();
    const el = document.querySelector('aside');
    const box = el.getBoundingClientRect();
    return {
      barLeft: Math.round(bar.left),
      barBottom: Math.round(bar.bottom),
      left: Math.round(box.left),
      above: Math.round(box.top - bar.bottom),
      below: Math.round(innerHeight - box.bottom),
      tall: box.height / innerHeight,
      fill: getComputedStyle(el).backgroundColor,
      barFill: getComputedStyle(document.querySelector('header.app-bar')).backgroundColor
    };
  });
  console.log(`sidebar      ${Math.round(idle)}x${Math.round(geo.tall * VIEWPORT.height)}px · inset l=${geo.left} above=${geo.above} below=${geo.below}`);
  if (geo.left !== geo.barLeft) {
    failures.push(`sidebar: the panel is ${geo.left}px off the left edge, the app bar sits at ${geo.barLeft}px`);
  }
  if (geo.above < 0) {
    failures.push('sidebar: the panel starts inside the app bar, the top view row is unclickable');
  }
  if (geo.above !== geo.below) {
    failures.push(`sidebar: ${geo.above}px of air above the panel and ${geo.below}px below, the vertical inset is uneven`);
  }
  if (geo.fill !== geo.barFill) {
    failures.push(`sidebar: the panel fills ${geo.fill} while the app bar fills ${geo.barFill}, it should be the same layer`);
  }
  if (geo.tall < 0.8) failures.push(`sidebar: the panel is only ${Math.round(geo.tall * 100)}% of the window tall, it is meant to span the column`);

  // The accessible name is the design's own text — "Rundown (1)" — so the visible
  // label and the hotkey are checked against it, and against the route list for order.
  for (const [i, row] of rows.entries()) {
    const [key, name] = VIEWS[i];
    if (row.key !== key) failures.push(`sidebar: row ${i} is named "${row.label}", expected the ${key} slot`);
    if (!row.icon) failures.push(`sidebar: "${name}" has no icon`);
    if (row.clipped) failures.push(`sidebar: "${name}" is clipped by the panel edge`);
    // Label and key read with no hover at all — that is the whole reason the strip
    // grew into a column.
    if (row.text !== `${row.name} ${row.key}`) {
      failures.push(`sidebar: row ${i} reads "${row.text}", its name "${row.label}" says otherwise`);
    }
  }
  if (rows.filter((r) => r.current === 'page').length !== 1) {
    failures.push('sidebar: the current view is not marked exactly once with aria-current');
  }
  await shot(page, `${OUT}/sidebar-rundown.png`);

  // Hover opens the dataset column over the canvas, so the strip itself must not move:
  // the dock growing means the labels collapsed into it, and the table would jump under
  // the pointer the moment someone reaches for a view.
  await page.locator('aside nav li button').first().hover();
  await page.waitForTimeout(450);
  if ((await panel.boundingBox()).width !== idle) {
    failures.push('sidebar: the panel changed width under the pointer');
  }
  // The column is a wing, not a card leaning on the rail: it has to overlap the dock's
  // border by exactly the width of that border, and the dock's corner has to square off
  // under it. Anything else draws the shared edge twice, or cuts a notch into the dock.
  const weld = await page.evaluate(() => {
    const rail = document.querySelector('aside');
    const fly = rail.querySelector('.rail-popover');
    const box = rail.getBoundingClientRect();
    const fb = fly.getBoundingClientRect();
    return {
      seam: Math.round(box.right - fb.left),
      top: Math.round(fb.top - box.top),
      radius: getComputedStyle(rail).borderTopRightRadius,
      open: getComputedStyle(fly).opacity,
      slide: getComputedStyle(fly).transform,
      railFill: getComputedStyle(rail).backgroundColor,
      flyFill: getComputedStyle(fly).backgroundColor,
      cardFill: getComputedStyle(fly.querySelector('dl').parentElement).backgroundColor
    };
  });
  console.log(
    `weld         seam=${weld.seam}px top=${weld.top}px corner=${weld.radius} column=${weld.open} ${weld.slide} · rail=${weld.railFill} fly=${weld.flyFill} card=${weld.cardFill}`
  );
  if (weld.seam < 1 || weld.seam > 2)
    failures.push(`sidebar: the column overlaps the dock by ${weld.seam}px, so the shared edge is ${weld.seam > 2 ? 'cut into the dock' : 'drawn twice'}`);
  if (weld.top !== 0) failures.push(`sidebar: the column's top edge sits ${weld.top}px off the dock's, so the two do not line up`);
  if (weld.radius !== '0px') failures.push(`sidebar: the dock keeps a ${weld.radius} corner under the column, so the two plates do not meet`);
  if (weld.open !== '1') failures.push('sidebar: hovering the dock leaves the dataset column down');
  if (weld.slide !== 'none') failures.push(`sidebar: an open column is still offset (${weld.slide}), so it is not flush with the rail`);
  // One object, two steps: the wing wears the dock's fill and the card inside lifts off it.
  if (weld.flyFill !== weld.railFill)
    failures.push(`sidebar: the column fills ${weld.flyFill} while the dock fills ${weld.railFill}, so the wing reads as a separate plate`);
  if (!(lum(chan(weld.cardFill)) > lum(chan(weld.flyFill))))
    failures.push(`sidebar: the dataset card is ${weld.cardFill} on a ${weld.flyFill} column, not a step lighter`);
  // A click in the nav leaves focus on the row that was pressed. The column must not read
  // that as still wanted, or it parks itself over the view someone just switched to.
  await page.getByRole('button', { name: /Analytics/ }).click();
  await page.mouse.move(4, 4);
  await page.waitForTimeout(450);
  const after = await page.evaluate(() => {
    const fly = document.querySelector('aside .rail-popover');
    const cs = getComputedStyle(fly);
    return {
      open: cs.opacity,
      click: cs.pointerEvents,
      slide: cs.transform,
      focus: document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName
    };
  });
  console.log(`switch       column=${after.open}/${after.click} ${after.slide} focus=${after.focus}`);
  if (after.open !== '0') failures.push(`sidebar: switching views through the nav left the dataset column up at opacity ${after.open}`);
  if (after.click !== 'none') failures.push('sidebar: the closed column still takes pointer events, so it eats clicks over the canvas');
  if (after.slide === 'none') failures.push('sidebar: a closed column sits at its open position, so it fades in rather than sliding out of the dock');
  if (!/Analytics/.test(after.focus)) failures.push(`sidebar: switching views moved focus to ${after.focus}, the pressed row should keep it`);
  await press('1');
  await page.mouse.move(4, 4);

  const switcher = page.locator('aside select[aria-label="Choose a dataset"]');
  if ((await switcher.count()) !== 1) {
    failures.push('sidebar: no dataset switcher, a bad upload has no way back');
    return;
  }
  // The switcher lives in the column the dock opens on hover, exactly where a person
  // reaches it from, so the check opens the dock before acting on anything inside it.
  await panel.hover();
  await page.waitForTimeout(250);
  await shot(page, `${OUT}/sidebar-flyout.png`);
  const options = await switcher.locator('option').evaluateAll((nodes) => nodes.map((o) => o.value));
  const live = await switcher.inputValue();
  const facts = await page.evaluate(() =>
    [...document.querySelectorAll('aside dl dd')].map((n) => n.textContent.trim())
  );
  console.log(`datasets     ${options.length} retained · live=${live} · ${facts.join('/')}`);
  if (facts.some((f) => !f)) {
    failures.push(`sidebar: the dataset facts read "${facts.join('/')}", one of them is empty`);
  }
  if (options.length < 2) {
    if (!(await switcher.isDisabled())) {
      failures.push('sidebar: the switcher is enabled with nothing to switch to');
    }
  } else {
    // Round trip: fall back to a retained upload and return, so the shared dataset ends
    // the run where it started.
    const other = options.find((v) => v !== live);
    await switcher.selectOption(other);
    await page.waitForTimeout(1000);
    const moved = await switcher.inputValue();
    await switcher.selectOption(live);
    await page.waitForTimeout(1000);
    const back = await switcher.inputValue();
    if (moved !== other) failures.push(`sidebar: switching to "${other}" left the dataset at "${moved}"`);
    if (back !== live) failures.push(`sidebar: the switcher could not return to "${live}", it is at "${back}"`);
  }
}

// The report fills the window and scrolls inside its own panel, under a head that pins to
// the top of that panel, so the sticky toolbar never sits on a row. Each half breaks
// quietly: drop the fill and the panel stops short of the foot, drop the bound and the page
// scroll returns with the head no longer sticking, and drop the head's stickiness and the
// column labels travel off the top. So scroll it and measure.
async function checkTableRegion() {
  for (const [key, name] of [['1', 'rundown'], ['2', 'rawCdr']]) {
    await press(key);
    const measure = () =>
      page.evaluate(() => {
        const tb = document.querySelector('main .panel.flex-wrap').getBoundingClientRect();
        const box = document.querySelector('main .panel.overflow-hidden > div');
        const b = box.getBoundingClientRect();
        const panel = box.parentElement.getBoundingClientRect();
        const th = document.querySelector('thead').getBoundingClientRect();
        return {
          room: Math.round(box.scrollHeight - box.clientHeight),
          scrolled: Math.round(box.scrollTop),
          underToolbar: Math.round(tb.bottom - b.top),
          headOff: Math.round(th.top - b.top),
          below: Math.round(innerHeight - panel.bottom),
          doc: Math.round(document.documentElement.scrollHeight - innerHeight)
        };
      });
    const rest = await measure();
    if (rest.room < 40) {
      failures.push(`table region [${name}]: the report only overflows its own panel by ${rest.room}px, so the scroll is unproven`);
      continue;
    }
    // The fill: the panel hands the table the rest of the window, so only main's own 24px
    // of padding may be left under it.
    if (rest.below > 32) failures.push(`table region [${name}]: the panel stops ${rest.below}px short of the window, so the space under it is wasted`);
    await page.evaluate(() => {
      document.querySelector('main .panel.overflow-hidden > div').scrollTop = 9999;
    });
    await page.waitForTimeout(300);
    const end = await measure();
    console.log(`table region [${name.padEnd(7)}] scrolled ${end.scrolled}/${rest.room}px · head +${end.headOff}px · ${-end.underToolbar}px under the toolbar · ${rest.below}px to the foot · page ${end.doc}px`);
    if (end.scrolled < rest.room - 2) failures.push(`table region [${name}]: the panel reached ${end.scrolled}px of ${rest.room}px, its scrollport is cut off`);
    if (end.doc > 0) failures.push(`table region [${name}]: the page itself scrolls ${end.doc}px, so the report is not bounded to the window`);
    if (Math.abs(end.headOff) > 1) failures.push(`table region [${name}]: scrolled, the head sits ${end.headOff}px below the panel top, so the column labels slide away`);
    if (end.underToolbar > 0) failures.push(`table region [${name}]: the report starts ${end.underToolbar}px above the toolbar's bottom edge, so they overlap`);
    await page.evaluate(() => {
      document.querySelector('main .panel.overflow-hidden > div').scrollTop = 0;
    });
  }
}

// The bottom bar is the only view switcher below lg, so it gets its own pass: every
// view reachable by a tap, the marker following the tap, and no button clipped off
// the edge — the exact failure the header row had at 375.
async function checkBottomNav() {
  const bar = page.locator('nav[aria-label="Views"]:visible');
  const shape = await bar.evaluate((el) => {
    const rects = [...el.querySelectorAll('button')].map((b) => b.getBoundingClientRect());
    return {
      count: rects.length,
      cut: rects.filter((r) => r.left < 0 || r.right > window.innerWidth + 1).length,
      height: Math.round(Math.min(...rects.map((r) => r.height))),
      overflow: el.scrollWidth - el.clientWidth
    };
  });
  console.log(`bottom nav   ${shape.count} views · ${shape.height}px tall · ${shape.cut} cut · ${shape.overflow}px overflow`);
  if (shape.count !== 5) failures.push(`bottom nav: ${shape.count} view buttons, expected 5`);
  if (shape.cut || shape.overflow > 1) failures.push(`bottom nav: ${shape.cut || shape.overflow}px of the bar runs off the screen, so a view cannot be reached`);
  if (shape.height < 44) failures.push(`bottom nav: the buttons are ${shape.height}px tall, under the 44px touch target`);
  for (const label of ['Rundown', 'Raw CDR', 'Analytics', 'Agents', 'Settings']) {
    await bar.locator('button', { hasText: label }).click();
    await page.waitForTimeout(700);
    const current = (await bar.locator('[aria-current="page"]').innerText()).trim();
    if (current !== label) failures.push(`bottom nav: tapping ${label} left the marker on ${current || 'nothing'}`);
  }
  console.log('bottom nav   all five views switch');
}

// 980 is a phone's "desktop site" layout viewport; since lg moved to 60rem it gets
// the sidebar. 768 and 375 are the widths with no rail, where the bottom bar owns it.
for (const width of [VIEWPORT.width, 1280, 980, 768, 375]) {
  await page.setViewportSize({ width, height: VIEWPORT.height });
  if (width === 375) await checkBottomNav();
  for (const [key, view] of VIEWS) {
    await press(key, view === 'analytics' ? 1200 : 500);
    const scroll = await page.evaluate(() => {
      // getClientRects() is empty for anything an ancestor has hidden, which reading
      // the nav's own display would miss (the rail's nav hides with its aside).
      const shown = (el) => el.getClientRects().length > 0;
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        rows: document.querySelectorAll('main tbody tr').length,
        sidebar: shown(document.querySelector('aside')),
        switchers: [...document.querySelectorAll('nav[aria-label="Views"]')].filter(shown).length
      };
    });
    if (scroll.overflow > 1) failures.push(`${width}px ${view}: page is ${scroll.overflow}px wider than the viewport`);
    // Exactly one nav may own the switcher at any width. Two on screen duplicating
    // the control (and the current-page marker); none strands the user on a view they
    // cannot leave. The failure names the width, not the component, because the bug
    // is the two breakpoints disagreeing.
    if (scroll.switchers !== 1) {
      failures.push(`${width}px ${view}: ${scroll.switchers} view switchers are on screen, expected exactly one`);
    }
    if (width !== VIEWPORT.width) {
      console.log(`${String(width).padStart(4)}px ${view.padEnd(10)} overflow=${scroll.overflow}px nav=${scroll.sidebar ? 'sidebar' : 'bottom'}`);
      // The phone layout is the one a reviewer cannot check from a desktop run, so
      // the artefact has to exist. Only the narrowest width gets one; 980 and 768
      // are the same markup with a different number of columns fitting. Viewport
      // height, not full page: the bottom bar is fixed, and a full-page shot would
      // paint it at the foot of a page no phone ever shows.
      if (width === 375) await shot(page, `${OUT}/${view}-375.png`);
      continue;
    }
    await shot(page, `${OUT}/${view}.png`, { fullPage: true });
    console.log(`${String(width).padStart(4)}px ${view.padEnd(10)} rows=${scroll.rows} overflow=${scroll.overflow}px`);
    await checkRings(view);
    await checkPopovers(view);
  }
  if (width === VIEWPORT.width) {
    await checkSidebar();
    await checkTableRegion();
  }
}

// Step 4's accessibility bundle, one assertion per defect it closed. Without these the
// repaint stays honest and the a11y fixes quietly rot back, because every one of them
// was invisible to a screenshot.
async function checkA11y() {
  await press('1');

  // A native title= answers the mouse and nothing else: no keyboard, no touchscreen,
  // no way to dismiss it, and it fires on the browser's schedule rather than yours.
  const natives = await page.evaluate(() =>
    [...document.querySelectorAll('[title]')]
      .filter((el) => el.closest('main, header'))
      .map((el) => `${el.tagName.toLowerCase()} "${(el.getAttribute('title') || '').slice(0, 18)}"`)
  );
  console.log(`titles   native=${natives.length}`);
  if (natives.length) failures.push(`tooltips: ${natives.length} native title= left in the page (${natives.slice(0, 3).join(', ')})`);

  // The sidebar's sample button was the app's only focusable tooltip trigger, so the
  // no-mouse path is now the click that `Tip` also answers. The panel still has to be
  // wired to aria-describedby while it is up, and still has to go away on Escape.
  const stamp = page.locator('main tbody td > .flex-col > span').first();
  await stamp.click();
  await page.waitForTimeout(140);
  const byClick = await page.evaluate(() => {
    const t = document.querySelector('[role="tooltip"]');
    if (!t) return null;
    return { text: t.textContent.trim().slice(0, 26), wired: !!document.querySelector(`[aria-describedby="${t.id}"]`) };
  });
  console.log(`tip click     ${byClick ? `"${byClick.text}" described=${byClick.wired}` : 'NOTHING'}`);
  if (!byClick) failures.push('tooltips: clicking a break stamp paints no tooltip, so nothing but a mouse can read it');
  else if (!byClick.wired) failures.push('tooltips: the panel on screen is not the node aria-describedby points at');
  // The same click is a copy. Not a defect to route around: a stamp is one value, and the
  // panel and the clipboard are two readings of it.
  const stamped = await page.getByText(/^Copied \d\d:/).count();
  console.log(`copy tip     stamp click copies too=${stamped > 0}`);
  if (!stamped) failures.push('copy: clicking a break stamp opened its panel but put nothing on the clipboard');
  await press('Escape', 140);
  if (await page.locator('[role="tooltip"]').count())
    failures.push('tooltips: Escape leaves the panel up, it is not dismissible (WCAG 1.4.13)');
  // The click parked the pointer on the stamp, and `pointerenter` does not fire for a
  // pointer that never left, so the hover path has to start from outside the cell.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(140);

  // The break stamp's panel floats above its anchor, and flips below when there is no
  // room — the head of the table is where that happens, since the sticky toolbar owns
  // the space above it.
  {
    // Count panel *mounts* inside the page rather than sampling from outside: a fast
    // strobe can slip between two polls 60ms apart, and it cannot slip past a
    // MutationObserver. One observer at a time — two live observers both see the same
    // mount and the count doubles, which reads exactly like the thing being detected.
    await page.evaluate(() => {
      window.__tipObs?.disconnect();
      window.__tipAdds = 0;
      window.__tipObs = new MutationObserver((rs) => {
        for (const r of rs) for (const n of r.addedNodes) if (n.nodeType === 1 && n.getAttribute?.('role') === 'tooltip') window.__tipAdds++;
      });
      window.__tipObs.observe(document.body, { childList: true });
    });
    const box = await stamp.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(200);
    const panel = await page.evaluate(() => {
      const t = document.querySelector('[role="tooltip"]');
      if (!t) return null;
      const r = t.getBoundingClientRect();
      // elementFromPoint at the panel's own centre is the pointer-steal test: a panel
      // that answers the pointer is what you hit there, and travelling onto the tooltip
      // to read it would then dismiss it. `pointer-events: none` makes it invisible to
      // hit-testing, so whatever is behind it answers instead.
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return {
        text: t.textContent.trim().slice(0, 26),
        inside: r.top >= 0 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
        steals: hit === t
      };
    });
    const adds = await page.evaluate(() => window.__tipAdds);
    console.log(`tip stamp    ${panel ? `"${panel.text}" inside=${panel.inside} mounts=${adds}` : 'NOTHING'}`);
    if (!panel) failures.push('tooltips: hovering the break stamp paints nothing, the hover path went with the native title');
    else {
      if (!panel.inside) failures.push(`tooltips: the break stamp tooltip is cut off by the viewport (${panel.text})`);
      if (panel.steals) failures.push('tooltips: the break stamp panel answers the pointer at its own centre, so moving onto it to read it dismisses it (WCAG 1.4.13)');
    }
    if (adds !== 1) failures.push(`tooltips: the break stamp panel mounted ${adds} times under a still cursor — it is flickering`);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(140);
  }

  // Clicking a stamp also copies it, so the region is not empty on arrival — it is empty
  // once that toast has lived out its 3.2s, which is the thing worth measuring here.
  const cleared = await page
    .waitForFunction(() => !document.querySelector('[aria-live]')?.children.length, null, { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (!cleared) failures.push('toasts: something parked in the live region and never left');
  const idle = await page.evaluate(() => {
    const r = document.querySelector('[aria-live]');
    return r ? { kids: r.children.length, text: r.textContent.trim() } : null;
  });
  console.log(`live        region=${idle ? 'mounted' : 'MISSING'} idle-kids=${idle ? idle.kids : '-'}`);
  if (!idle) failures.push('toasts: no [aria-live] region exists while idle, so a toast arrives as a new node, not a change');
  else if (idle.kids) failures.push(`toasts: the live region is not empty at rest (${idle.kids} left over), it will read stale text on load`);
  // A toast has to be produced by something, and the sample button is gone. The Views
  // popover still refuses an unnamed save out loud, which is the same live-region path.
  await page.getByRole('button', { name: /Views/ }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForTimeout(300);
  const announced = await page.evaluate(() => document.querySelector('[aria-live]')?.textContent.trim() ?? '');
  console.log(`announced   "${announced.slice(0, 34)}"`);
  if (!announced) failures.push('toasts: an unnamed save put no message inside the live region');
  await page.keyboard.press('Escape');
  // The Save button lives in a panel that hangs over the head of the table, so the
  // pointer is left sitting on row one — and the row's hover wash is exactly the tint
  // that pulls the extension's contrast under the floor. Park it somewhere inert.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(1500);

  // Every figure in the first row, composited over its own tint and the row behind it.
  // The three contrast defects the audit found were all of this shape: a role colour at
  // 70% alpha over a role tint at 10%, which no single computed value betrays.
  const cells = await read({ sel: 'main tbody tr:first-child td > *', all: true });
  const weak = [];
  for (const c of cells || []) {
    // An icon plate carries a glyph, not text, so it answers to 3:1 (SC 1.4.11) and a
    // label answers to 4.5. Empty cells are a dash rendered by another column's probe.
    const cr = between(c.text, fillOf(c));
    const floor = c.label ? 4.5 : 3;
    if (cr < floor) weak.push(`"${c.label.slice(0, 12) || '[glyph]'}" ${cr.toFixed(2)}:1 needs ${floor} (${c.text} on ${fillOf(c).map(Math.round)})`);
  }
  console.log(`cells       ${(cells || []).length} composited · below floor=${weak.length}`);
  if (weak.length) failures.push(`contrast: ${weak.join(' | ')}`);

  // SC 2.5.8: 24x24. A control may be smaller only when something bigger takes the same
  // input, so the exemption is proven by measuring that something, not by asserting it.
  const small = await page.evaluate(() => {
    const SEL =
      'main button, main input, main select, main [role="button"], main a[href], main label:has(input), aside button, aside input, aside select, aside label:has(input), header.app-bar button';
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return r.width * r.height;
    };
    const out = [];
    let total = 0;
    for (const el of document.querySelectorAll(SEL)) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      total++;
      if (r.width * r.height >= 576) continue;
      const label = (el.getAttribute('aria-label') || el.textContent || el.type || '').trim().slice(0, 22);
      const host = el.closest('label') || el.closest('.relative') || el.parentElement;
      const partner = host ? [...host.querySelectorAll('input, button, label')].find((n) => n !== el && box(n) >= 576) : null;
      out.push({ label, w: Math.round(r.width), h: Math.round(r.height), partner: partner ? Math.round(box(partner)) : 0 });
    }
    return { total, out };
  });
  const unjust = small.out.filter((t) => !t.partner);
  console.log(`targets     ${small.total} measured · under 24x24=${small.out.length} unjustified=${unjust.length}`);
  if (small.out.length)
    console.log(`            ${small.out.map((t) => `"${t.label}" ${t.w}x${t.h}${t.partner ? ` via ${t.partner}px2` : ' NO FALLBACK'}`).join(', ')}`);
  if (unjust.length)
    failures.push(`targets: ${unjust.map((t) => `"${t.label}" ${t.w}x${t.h}`).join(', ')} sit under 576px2 with no larger control taking the same input`);

  await press('4');
  await page.locator('button', { hasText: 'Add mapping' }).first().click();
  await page.waitForTimeout(300);
  await page.locator('[role="dialog"] button[type="submit"]').click();
  await page.waitForTimeout(250);
  const form = await page.evaluate(() => {
    const input = document.querySelector('[role="dialog"] #agent-ext');
    const msg = document.querySelector('[role="dialog"] [role="alert"]');
    return {
      invalid: input ? input.getAttribute('aria-invalid') : null,
      same: !!(input && msg && document.getElementById(input.getAttribute('aria-describedby') || '') === msg),
      text: msg ? msg.textContent.trim() : null
    };
  });
  console.log(`form error  invalid=${form.invalid} described=${form.same} "${(form.text || '').slice(0, 26)}"`);
  if (!form.text) failures.push('forms: an empty submit produces no error message in the dialog');
  else if (form.invalid !== 'true') failures.push('forms: the rejected field does not say so with aria-invalid');
  else if (!form.same) failures.push('forms: the error is not the node the field points at with aria-describedby');
  await press('Escape', 250);
}

await browser.close();

if (failures.length) {
  console.log(`\nFAIL ${failures.length}`);
  failures.forEach((f) => console.log(` - ${f}`));
  process.exit(1);
}
console.log('\nOK all menus and previews on top, no page overflow, no console errors');
