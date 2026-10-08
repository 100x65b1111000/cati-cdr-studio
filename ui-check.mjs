// Layering + overflow sweep for every view. Start the dev server, then:
//   node ui-check.mjs
// Screenshots land in _ui/. Exit 1 when something is buried, clipped or throwing.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { COLOR_SCHEMES, DEFAULT_SCHEME, cssVarName, hexToRgbTriplet } from './src/theme/colorSchemes.js';

const BASE = process.env.UI_URL || 'http://localhost:3000';
const OUT = '_ui';
const VIEWPORT = { width: 1440, height: 950 };
mkdirSync(OUT, { recursive: true });

const VIEWS = [
  ['1', 'rundown'],
  ['2', 'rawCdr'],
  ['3', 'analytics'],
  ['4', 'directory'],
  ['5', 'settings']
];

const failures = [];

// Windows can hold a recently-viewed PNG open for a moment, which fails the write.
async function shot(page, path, opts) {
  try {
    await page.screenshot({ path, ...opts });
  } catch {
    await page.waitForTimeout(600);
    await page.screenshot({ path, ...opts });
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: VIEWPORT });
page.on('console', (m) => {
  if (m.type() === 'error') failures.push(`console: ${m.text()}`);
});
page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: /sample data/i }).click();
await page.waitForSelector('main tbody tr', { timeout: 20000 });
await checkBackdrop();
await checkDots();
await checkFrost();

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
    const menu = page.locator('.glass-menu');
    if ((await menu.count()) === 0) {
      failures.push(`${view}: "${label}" opened with no .glass-menu in the DOM`);
      continue;
    }
    await probe(menu.last(), view, label);
    await shot(page, `${OUT}/${view}--${label.replace(/[^\w-]+/g, '-')}.png`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);
  }
}

// The backdrop glow is composited from tokens plus an animated opacity, so nothing
// in the CSS states whether a plate actually stands out. Measure the worst case at
// the peak of the pulse: a patch brighter than the plate on top of it is invisible.
async function checkBackdrop() {
  const m = await page.evaluate(() => {
    const rgbOf = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim().split(/[\s,/]+/).filter(Boolean).map(Number);
    const L = ([r, g, b]) => {
      const f = (v) => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      const y = 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
    };
    const over = (fg, bg, a) => fg.map((c, i) => c * a + bg[i] * (1 - a));
    let peak = 0;
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      for (const r of rules) {
        if (r.type === CSSRule.KEYFRAMES_RULE && r.name === 'pulseSlow') {
          for (const k of r.cssRules) peak = Math.max(peak, Number(k.style.opacity) || 0);
        }
      }
    }
    const pageC = rgbOf('--k-page');
    const surface = rgbOf('--k-surface');
    let worst = 99;
    for (const b of document.querySelectorAll('.blob')) {
      const parts = getComputedStyle(b).backgroundColor.match(/[\d.]+/g).map(Number);
      const patch = over(parts.slice(0, 3), pageC, (parts[3] ?? 1) * peak);
      worst = Math.min(worst, L(over(surface, patch, 0.9)) - L(patch));
    }
    // The dot lattice is checked across every scheme, not here. See checkDots().
    return { peak, worst, flat: L(surface) - L(pageC) };
  });
  if (m.peak === 0) return;
  if (m.worst < 3) failures.push(`backdrop: glow patch at pulse peak (opacity ${m.peak}) is only ${m.worst.toFixed(1)} L* below the plates`);
  if (m.flat < 4) failures.push(`backdrop: surface sits only ${m.flat.toFixed(1)} L* above the page`);
  console.log(`backdrop   peak-opacity=${m.peak} plate-vs-glow dL*=${m.worst.toFixed(1)} plate-vs-page dL*=${m.flat.toFixed(1)}`);
}

// A 24px dot lattice is only perceptible relative to the page it sits on, which is
// why `dot` is a per-scheme token instead of one alpha over `hairline`. Measuring
// only the default scheme is exactly how "barely visible on the softer themes"
// passed a check that reported green.
async function checkDots() {
  const vars = Object.entries(COLOR_SCHEMES[DEFAULT_SCHEME].colors).map(([role]) => cssVarName(role));
  const restore = await page.evaluate(
    (names) => names.map((n) => [n, document.documentElement.style.getPropertyValue(n)]),
    vars
  );
  const schemeLists = Object.entries(COLOR_SCHEMES).map(([id, s]) => [
    id,
    Object.entries(s.colors).map(([role, hex]) => [cssVarName(role), hexToRgbTriplet(hex)])
  ]);

  const out = await page.evaluate((lists) => {
    const rgbOf = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim().split(/[\s,/]+/).filter(Boolean).map(Number);
    const Y = ([r, g, b]) => {
      const f = (v) => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const over = (fg, bg, a) => fg.map((c, i) => c * a + bg[i] * (1 - a));
    const rows = [];
    for (const [id, vars] of lists) {
      for (const [n, v] of vars) document.documentElement.style.setProperty(n, v);
      const pageC = rgbOf('--k-page');
      // Read the fills out of the live CSS instead of restating them here, so this
      // cannot drift from index.css the way the original glass did.
      const fills = ['.panel', '.glass-card']
        .map((sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const n = getComputedStyle(el).backgroundColor.match(/rgba?\(([^)]+)\)/)?.[1]
            .split(/[\s,/]+/).filter(Boolean).map(Number);
          return n && { rgb: n.slice(0, 3), a: n[3] ?? 1 };
        })
        .filter(Boolean);
      let lift = 99, leak = 0;
      for (const el of document.querySelectorAll('.dot-bg')) {
        // Read the colour out of the rendered gradient, so this also proves the
        // token is actually wired through to the rule.
        const fn = getComputedStyle(el).backgroundImage.match(/rgba?\(([^)]+)\)/);
        if (!fn) continue;
        const n = fn[1].split(/[\s,/]+/).filter(Boolean).map(Number);
        const dot = over(n.slice(0, 3), pageC, n[3] ?? 1);
        lift = Math.min(lift, Y(dot) / Y(pageC));
        for (const f of fills) {
          const plate = over(f.rgb, pageC, f.a);
          leak = Math.max(leak, Y(over(dot, plate, 1 - f.a)) / Math.max(Y(plate), 1e-6));
        }
      }
      rows.push({ id, lift, leak });
    }
    return rows;
  }, schemeLists);

  await page.evaluate((pairs) => {
    for (const [n, v] of pairs) {
      if (v) document.documentElement.style.setProperty(n, v);
      else document.documentElement.style.removeProperty(n);
    }
  }, restore);

  for (const r of out) {
    // 1.10x plate luminance is about 1 L* at these levels: enough to see the card
    // edges, not enough to read dots inside it.
    if (r.lift < 2) failures.push(`backdrop [${r.id}]: lattice only ${r.lift.toFixed(2)}x the page, too faint to read`);
    if (r.leak > 1.1) failures.push(`backdrop [${r.id}]: lattice leaks to ${r.leak.toFixed(2)}x plate luminance through the fills, cards look speckled`);
    console.log(`dots ${r.id.padEnd(11)} ${r.lift.toFixed(2)}x-page leak=${r.leak.toFixed(2)}x-plate`);
  }
}

// Frosted glass needs two things, and a `backdrop-filter` declaration only
// guarantees one of them: the backdrop has to show through the fill, and it has
// to have enough structure that softening it is visible. Both are measurable by
// re-shooting the same crop twice with one property neutered, and letting
// Chromium decode the PNGs. `show` is how much of the backdrop gets through at
// all; `smear` is how much removing the blur changes it. A plate that is merely
// translucent scores high on show and zero on smear.
async function checkFrost() {
  const meanAbsDiff = ([a, b]) => {
    const grab = async (d) => {
      const img = new Image();
      img.src = `data:image/png;base64,${d}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      return c.getContext('2d').getImageData(0, 0, img.width, img.height).data;
    };
    return Promise.all([grab(a), grab(b)]).then(([p, q]) => {
      let s = 0;
      for (let i = 0; i < p.length; i += 4) {
        s += Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]);
      }
      return s / (p.length / 4) / 3;
    });
  };

  async function gap(clip, css) {
    const base = (await page.screenshot({ clip })).toString('base64');
    const tag = await page.addStyleTag({ content: css });
    const alt = (await page.screenshot({ clip })).toString('base64');
    await tag.evaluate((el) => el.remove());
    return page.evaluate(meanAbsDiff, [base, alt]);
  }

  async function measure(name, sel, fill, clip) {
    const slug = name.replace(/[^\w-]+/g, '-').toLowerCase();
    // The eyeball shot, taken before the veil and the neuters below.
    await shot(page, `${OUT}/frost-${slug}.png`, { clip });
    // Tag the one node under test. Everything else scopes through [data-frost], so
    // a nested glass (the rail preview is a .glass-menu too) cannot confound it.
    await page.evaluate((s) => document.querySelector(s)?.setAttribute('data-frost', ''), sel);
    // Freeze the pulse and any entrance animation so the two shots differ only by
    // the property under test, and hide the surface's own children: a popover is
    // mostly covered by its options, which are not the glass.
    await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
    const veil = await page.addStyleTag({ content: `[data-frost]>*{visibility:hidden!important}` });
    // Same hue at full alpha, so the delta measures transmission, not a colour swap.
    const show = await gap(clip, `[data-frost]{background-image:none!important;background-color:rgb(var(${fill})/1)!important}`);
    const smear = await gap(clip, `[data-frost]{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}`);
    await page.evaluate(() => document.querySelector('[data-frost]')?.removeAttribute('data-frost'));
    await veil.evaluate((el) => el.remove());
    await page.evaluate(() => document.getAnimations().forEach((a) => a.play()));
    // Two dark-on-dark surfaces, so absolute channel deltas are small by nature.
    // `show` only has to prove something gets through; `smear` is the one that
    // answers the complaint, and it is what a merely-translucent fill fails.
    if (show < 1.5) failures.push(`frost [${name}]: only ${show.toFixed(1)}/255 of the backdrop shows through, the fill is opaque`);
    if (smear < 2) failures.push(`frost [${name}]: dropping the blur changes ${smear.toFixed(1)}/255, so the blur is doing nothing`);
    console.log(`frost ${name.padEnd(14)} show=${show.toFixed(1)} smear=${smear.toFixed(1)}`);
  }

  // Frost needs a real backdrop. A crop that happens to sit over the flat page
  // measures nothing and reads as a pass, so aim it at a point where the paint stack
  // behind the glass actually contains a table row. `closest` because thead is not in
  // the hit stack at all: over the head, elementsFromPoint reports the TH.
  async function backdropHasCell(x, y) {
    return page.evaluate(
      ([px, py]) => {
        const stack = document.elementsFromPoint(px, py);
        const i = stack.findIndex((el) => el.closest('.glass-head, .glass-menu, .panel'));
        if (i < 0) return false;
        return stack.slice(i + 1).some((el) => el.tagName === 'TD');
      },
      [x, y]
    );
  }

  // Not the app header: every table has its own scroll container, so the page only
  // moves 19px and nothing ever slides under the plate. The sticky table head is the
  // surface that has live rows passing under it all day, which is where frost either
  // shows or does not. Raw CDR, so the scrollback is long enough to be worth reading.
  await page.keyboard.press('2');
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const box = document.querySelector('main .overflow-auto');
    if (box) box.scrollTop = 240;
  });
  await page.waitForTimeout(300);
  const head = await page.locator('main thead.glass-head').first().boundingBox();
  if (!head) {
    failures.push('frost: no thead.glass-head to measure, the sticky head lost its class');
    return;
  }
  const hClip = { x: head.x + head.width / 2 - 210, y: head.y + 4, width: 420, height: Math.min(head.height - 8, 40) };
  if (!(await backdropHasCell(hClip.x + 210, hClip.y + 20))) {
    failures.push('frost: no row behind the head crop, it is measuring the plate rather than a backdrop');
  }
  await measure('head over rows', 'main thead.glass-head', '--k-sunken', hClip);

  await page.keyboard.press('1');
  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await page.locator('main button[aria-expanded]').first().click();
  await page.waitForTimeout(400);
  const menu = await page.locator('main .glass-menu').first().boundingBox();
  if (!menu) {
    failures.push('frost: no .glass-menu open to measure');
    return;
  }
  const mClip = { x: menu.x + 20, y: menu.y + 20, width: Math.min(menu.width - 40, 240), height: Math.min(menu.height - 40, 120) };
  if (!(await backdropHasCell(mClip.x + mClip.width / 2, mClip.y + mClip.height / 2))) {
    failures.push('frost: no table cell behind the menu crop, it is measuring the page rather than a backdrop');
  }
  await measure('menu over table', 'main .glass-menu', '--k-surface', mClip);
  await page.keyboard.press('Escape');
}

// The sidebar previews float over live table text, which is the exact shape the
// dropdown-behind-table bug came from, so they get the same hit test.
async function checkPreviews() {
  await page.keyboard.press('1');
  await page.waitForTimeout(350);
  const items = page.locator('aside nav li');
  const total = await items.count();
  if (total === 0) {
    failures.push('sidebar: no nav items found, the rail did not render');
    return;
  }
  const rail = page.locator('aside nav');
  const idle = (await rail.boundingBox()).width;
  if (idle > 64) {
    failures.push(`sidebar: the rail is ${Math.round(idle)}px wide while idle, it should be icon-only`);
  }
  await shot(page, `${OUT}/sidebar-idle.png`);
  for (let i = 0; i < total; i++) {
    const item = items.nth(i);
    const label = ((await item.innerText()) || '').replace(/\s+/g, ' ').trim().slice(0, 16) || `item${i}`;
    await item.hover();
    // 120ms open delay, plus the 200ms width transition, plus a frame for the
    // backdrop-filter layer to composite.
    await page.waitForTimeout(420);
    if (i === 0) {
      const wide = (await rail.boundingBox()).width;
      if (wide < 200) {
        failures.push(`sidebar: the rail only reached ${Math.round(wide)}px on hover, it should expand`);
      }
    }
    // The preview is pointer-events-none so the cursor can cross it without
    // re-triggering the hover, but elementFromPoint then skips it entirely and
    // reports the table behind. Flip it on for the hit test only; paint order is
    // unaffected by the property.
    const card = page.locator('aside .glass-menu');
    if ((await card.count()) === 0) {
      failures.push(`sidebar: hovering "${label}" produced no preview`);
      continue;
    }
    // The previews are real mounted views now. Poll for rendered nodes rather
    // than a fixed wait: the analytics chunk is lazy, and not every view has a
    // button to wait on.
    try {
      await page.waitForFunction(
        () => {
          const t = document.querySelector('aside .glass-menu [data-thumb]');
          return t && t.querySelectorAll('*').length > 40;
        },
        null,
        { timeout: 4000 }
      );
    } catch {
      failures.push(`sidebar: "${label}" preview rendered no real view content`);
      continue;
    }
    await card.first().evaluate((el) => { el.style.pointerEvents = 'auto'; });
    await probe(card.first(), 'sidebar', label);
    await card.first().evaluate((el) => { el.style.pointerEvents = ''; });
    await shot(page, `${OUT}/sidebar-${label.replace(/[^\w-]+/g, '-')}.png`);
    await page.mouse.move(4, 4);
    await page.waitForTimeout(120);
  }
}

for (const width of [VIEWPORT.width, 1280, 820]) {
  await page.setViewportSize({ width, height: VIEWPORT.height });
  for (const [key, view] of VIEWS) {
    await page.keyboard.press(key);
    await page.waitForTimeout(view === 'analytics' ? 1200 : 350);
    const scroll = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      rows: document.querySelectorAll('main tbody tr').length
    }));
    if (scroll.overflow > 1) failures.push(`${width}px ${view}: page is ${scroll.overflow}px wider than the viewport`);
    if (width !== VIEWPORT.width) {
      console.log(`${String(width).padStart(4)}px ${view.padEnd(10)} overflow=${scroll.overflow}px`);
      continue;
    }
    await shot(page, `${OUT}/${view}.png`, { fullPage: true });
    console.log(`${String(width).padStart(4)}px ${view.padEnd(10)} rows=${scroll.rows} overflow=${scroll.overflow}px`);
    await checkPopovers(view);
  }
  if (width === VIEWPORT.width) await checkPreviews();
}

await browser.close();

if (failures.length) {
  console.log(`\nFAIL ${failures.length}`);
  failures.forEach((f) => console.log(` - ${f}`));
  process.exit(1);
}
console.log('\nOK all menus and previews on top, no page overflow, no console errors');
