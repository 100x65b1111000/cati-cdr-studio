// Layering + overflow sweep for every view. Start the dev server, then:
//   node ui-check.mjs
// Screenshots land in _ui/. Exit 1 when something is buried, clipped or throwing.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { COLOR_SCHEMES, DEFAULT_SCHEME, cssVarName, hexToRgbTriplet } from './src/theme/colorSchemes.js';
import { pickRange } from './src/utils/dateRange.js';

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
await checkChrome();
await checkSchemeCard();
await checkInteractions();
await checkTone();
await checkThreshold();
await checkDetail();
await checkCellSteppers();
await checkFieldHover();
await checkToolbarFits();
await checkPrintTone();
await checkCalendar();
await checkRawCdrFilter();
await checkInk();
await checkAlign();
await checkDirectory();
await checkViewTitles();
await checkDayGroups();

// The mapping list burned a full page of width on two short values. The grid is the
// fix, so measure the packing rather than trusting the class names.
async function checkDirectory() {
  await page.keyboard.press('4');
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('main .glass-card')];
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
// the trigger's own icon rather than a restated hex, so it survives a scheme switch
// and it fails if the hue is wired to the menu but not to the button.
async function checkTone() {
  await page.keyboard.press('1');
  await page.waitForTimeout(350);

  const ch = (s) => ((s || '').match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const same = (a, b) => a.length === 3 && b.length === 3 && a.every((n, i) => Math.abs(n - b[i]) <= 1);
  const key = (a) => (a ? a.join(',') : 'none');

  async function probe(label) {
    const trigger = page.locator('main button[aria-expanded]').filter({ hasText: label }).first();
    if (!(await trigger.count())) {
      failures.push(`tone: no "${label}" popover to open`);
      return null;
    }
    // The idle trigger colours its icon through the tone map, so the icon is the hue
    // the user says the menu should match.
    const icon = ch(await trigger.locator('svg').first().evaluate((el) => getComputedStyle(el).color));
    await trigger.click();
    await page.waitForTimeout(260);
    // The menu lives inside the trigger's own wrapper, and the wrapper is what
    // declares --tone. Measuring `.glass-menu` globally picks up whatever panel a
    // previous check left open, so scope the read to the popover actually probed.
    const menu = trigger.locator('xpath=ancestor::div[1]').locator('.glass-menu');
    if (!(await menu.count())) {
      failures.push(`tone: "${label}" never opened a menu`);
      return null;
    }
    const r = await menu.evaluate((el) => {
      const p = document.createElement('span');
      p.style.color = 'rgb(var(--tone, var(--k-accent)) / 1)';
      el.appendChild(p);
      const tone = getComputedStyle(p).color;
      p.remove();
      const on = el.querySelector('.cbox:checked');
      const field = el.querySelector('.glass-input');
      let fieldBorder = null;
      if (field) {
        field.focus();
        fieldBorder = getComputedStyle(field).borderTopColor;
        field.blur();
      }
      const btn = el.querySelector('.tone-btn');
      return {
        tone,
        border: getComputedStyle(el).borderTopColor,
        fill: on ? getComputedStyle(on).backgroundColor : null,
        hasBox: !!on,
        btn: btn ? getComputedStyle(btn).backgroundColor : null,
        fieldBorder
      };
    });
    // The hover step, in the tone too: a border that repaints to some other hue is
    // the half-finished version of the same bug. A panel that has saved nothing yet
    // has no hoverable rows, so absence is skipped rather than hunted.
    const item = menu.locator('.glow-hover').first();
    let hoverBorder = null;
    if (await item.count()) {
      await item.hover();
      await page.waitForTimeout(200);
      hoverBorder = ch(await item.evaluate((el) => getComputedStyle(el).borderTopColor));
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    return {
      icon,
      tone: ch(r.tone),
      border: ch(r.border),
      fill: r.fill ? ch(r.fill) : null,
      hoverBorder,
      hasBox: r.hasBox,
      btn: r.btn ? ch(r.btn) : null,
      fieldBorder: r.fieldBorder ? ch(r.fieldBorder) : null
    };
  }

  const agents = await probe('Agents');
  const columns = await probe('Columns');
  const views = await probe('Views');
  if (!agents || !columns || !views) return;

  console.log(
    `tone agents  icon=${key(agents.icon)} menu=${key(agents.tone)} border=${key(agents.border)} box=${key(agents.fill)} hover=${key(agents.hoverBorder)}`
  );
  console.log(
    `tone columns  icon=${key(columns.icon)} menu=${key(columns.tone)} border=${key(columns.border)} box=${key(columns.fill)} hover=${key(columns.hoverBorder)}`
  );
  console.log(
    `tone views  icon=${key(views.icon)} menu=${key(views.tone)} border=${key(views.border)} btn=${key(views.btn)} field=${key(views.fieldBorder)}`
  );

  if (key(agents.tone) === key(columns.tone)) {
    failures.push(`tone: the Agents and Columns menus share hue ${key(agents.tone)}, the popover is not following its trigger`);
  }
  for (const [name, p] of [['agents', agents], ['columns', columns], ['views', views]]) {
    if (!same(p.icon, p.tone)) failures.push(`tone [${name}]: the menu is ${key(p.tone)} but its trigger icon is ${key(p.icon)}`);
    if (!same(p.icon, p.border)) failures.push(`tone [${name}]: the menu edge is ${key(p.border)}, not the trigger's ${key(p.icon)}`);
    if (p.hoverBorder && !same(p.icon, p.hoverBorder)) failures.push(`tone [${name}]: a hovered menu item lights ${key(p.hoverBorder)} instead of ${key(p.icon)}`);
    // A checked box is the loudest element in the panel; a blue tick in an amber menu
    // reads as two different apps stitched together.
    if (p.hasBox) {
      if (!p.fill) failures.push(`tone [${name}]: the menu has a checked box but no fill to read`);
      else if (!same(p.icon, p.fill)) failures.push(`tone [${name}]: a checked box fills ${key(p.fill)}, not the trigger's ${key(p.icon)}`);
    }
    // Controls the panel owns, painted by the call site rather than the stylesheet.
    if (p.btn && !same(p.icon, p.btn)) failures.push(`tone [${name}]: the panel's primary button is ${key(p.btn)}, not the trigger's ${key(p.icon)}`);
    if (p.fieldBorder && !same(p.icon, p.fieldBorder)) failures.push(`tone [${name}]: a focused field in the panel edges to ${key(p.fieldBorder)}, not the trigger's ${key(p.icon)}`);
  }
  if (!views.btn) failures.push('tone [views]: the Save button lost its .tone-btn class, it is accent again');
}

// The break threshold control: a bordered, centred number with a stepper that
// commits rather than leaving a draft behind.
async function checkThreshold() {
  await page.keyboard.press('1');
  await page.waitForTimeout(350);
  const field = page.locator('main input[aria-label="Idle break threshold in minutes"]');
  if (!(await field.count())) {
    failures.push('threshold: no break threshold field to measure');
    return;
  }
  const rest = await field.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { value: el.value, border: parseFloat(cs.borderTopWidth), color: cs.borderTopColor, align: cs.textAlign };
  });
  console.log(`threshold ${rest.value}min border=${rest.border}px ${rest.color} align=${rest.align}`);
  if (rest.border < 1) failures.push('threshold: the field has no border, it is still a bare box in the pill');
  if (/rgba\(0, 0, 0, 0\)|transparent/.test(rest.color)) failures.push('threshold: the field border is transparent');
  if (rest.align !== 'center') failures.push(`threshold: the value is "${rest.align}"-aligned in a fixed box`);

  // The toolbar is a single flex-wrap row with no room to spare. Anything that
  // widens a control can push Print/Export onto a second line, so measure the row.
  const bar = await page.evaluate(() => {
    const el = document.querySelector('main .panel.flex-wrap');
    const tops = [...el.children].map((k) => k.getBoundingClientRect().top);
    return { h: Math.round(el.getBoundingClientRect().height), wrapped: tops.filter((t) => t - Math.min(...tops) > 6).length };
  });
  console.log(`toolbar  h=${bar.h}px wrapped=${bar.wrapped}`);
  if (bar.wrapped) failures.push(`threshold: the toolbar broke into a second row (${bar.h}px tall), a control is too wide`);

  // The carets belong inside the field. If they escape the box they are flanking
  // buttons again, which is the width this layout cannot afford.
  const nest = await page.evaluate(() => {
    const i = document.querySelector('main input[aria-label="Idle break threshold in minutes"]').getBoundingClientRect();
    const u = document.querySelector('main button[aria-label="Increase the break threshold by one minute"]').getBoundingClientRect();
    return u.left >= i.left && u.right <= i.right + 0.5 && u.top >= i.top - 0.5 && u.bottom <= i.bottom + 0.5;
  });
  if (!nest) failures.push('threshold: the stepper sits outside the field, it is costing the toolbar width again');

  // The pill gained two stepper buttons, so the crop is here to catch it overflowing
  // its own container rather than wrapping cleanly.
  const pill = await field.locator('xpath=ancestor::div[1]').boundingBox();
  if (pill) {
    await shot(page, `${OUT}/threshold-idle.png`, {
      clip: {
        x: Math.max(0, pill.x - 12),
        y: Math.max(0, pill.y - 12),
        width: Math.min(pill.width + 24, VIEWPORT.width - 4),
        height: Math.min(pill.height + 24, VIEWPORT.height - 4)
      }
    });
    await field.focus();
    await page.waitForTimeout(180);
    await shot(page, `${OUT}/threshold-focus.png`, {
      clip: {
        x: Math.max(0, pill.x - 12),
        y: Math.max(0, pill.y - 12),
        width: Math.min(pill.width + 24, VIEWPORT.width - 4),
        height: Math.min(pill.height + 24, VIEWPORT.height - 4)
      }
    });
    await field.blur();
  }

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
  await step('Increase the break threshold by one minute');
  await step('Decrease the break threshold by one minute');
  console.log(`steppers  +1=${up} toast=${toast} -1=${down} back=${await field.inputValue()}`);
  if (String(Number(rest.value) + 1) !== up) failures.push(`threshold: + set the field to "${up}" from "${rest.value}"`);
  if (!toast) failures.push('threshold: + changed the draft but never committed it, no recalculation reported');
  if (String(Number(up) - 1) !== down) failures.push(`threshold: - set the field to "${down}" from "${up}"`);
}

// How a row behaves, and how a panel closes. Both were wrong by accident at some
// point: the whole row opened the agent panel, and the close button hovered accent
// blue like every other control.
async function checkDetail() {
  await page.keyboard.press('1');
  await page.waitForTimeout(350);

  const chip = await page.evaluate(() => {
    const el = document.querySelector('main tbody tr td:nth-child(3) > span');
    if (!el) return null;
    const cs = getComputedStyle(el);
    const probe = document.createElement('span');
    probe.style.color = 'rgb(var(--k-accent))';
    document.body.appendChild(probe);
    const accent = getComputedStyle(probe).color;
    probe.remove();
    return { text: el.innerText.trim(), bg: cs.backgroundColor, color: cs.color, accent, radius: parseFloat(cs.borderRadius) || 0 };
  });
  const ch3 = (s) => ((s || '').match(/[\d.]+/g) || []).slice(0, 3).map(Number).join(',');
  const near = (a, b) => ch3(a).split(',').every((n, i) => Math.abs(Number(n) - Number(ch3(b).split(',')[i])) <= 2);
  console.log(`chip   calls="${chip?.text}" bg=${chip?.bg} text=${ch3(chip?.color)} accent=${ch3(chip?.accent)} radius=${chip?.radius}`);
  if (!chip) failures.push('chip: no total-calls cell to read');
  else {
    if (/rgba\(0, 0, 0, 0\)|transparent/.test(chip.bg)) failures.push(`chip: the total sits on nothing (bg=${chip.bg}), it is not a chip`);
    if (chip.radius < 2) failures.push(`chip: the total's corners are ${chip.radius}px, it is a raw block not a chip`);
    if (!near(chip.color, chip.accent)) failures.push(`chip: the total reads ${ch3(chip.color)}, a flat grey on grey is the bland version`);
  }

  await page.locator('main tbody tr').nth(1).click();
  await page.waitForTimeout(400);
  if (await page.locator('[role="dialog"]').count()) {
    failures.push('details: clicking a row opens the agent panel, only the Details button should');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  await page.locator('main tbody tr [aria-label^="Breakdown for"]').first().click();
  await page.waitForTimeout(500);
  const close = page.locator('[role="dialog"] button[aria-label="Close"]');
  if (!(await close.count())) {
    failures.push('details: the Details button no longer opens the panel');
    return;
  }
  const paint = await close.evaluate((el) => {
    const p = document.createElement('span');
    p.style.color = 'rgb(var(--k-danger) / 1)';
    el.appendChild(p);
    const want = getComputedStyle(p).color;
    p.remove();
    const cs = getComputedStyle(el);
    return { want, color: cs.color, bg: cs.backgroundColor };
  });
  await close.hover();
  await page.waitForTimeout(220);
  const on = await close.evaluate((el) => {
    const cs = getComputedStyle(el);
    return `${cs.color}|${cs.backgroundColor}|${cs.boxShadow}`;
  });
  const nums = (s) => ((s || '').match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const rest = `${paint.color}|${paint.bg}`;
  console.log(`close  danger=${nums(paint.want).join(',')} idle=${nums(paint.color).join(',')} bg=${nums(paint.bg).join(',')}`);
  if (!nums(paint.want).every((n, i) => Math.abs(n - nums(paint.color)[i]) <= 2))
    failures.push(`close: the button is ${nums(paint.color).join(',')}, not the scheme's danger ${nums(paint.want).join(',')}`);
  if (/rgba\(0, 0, 0, 0\)|transparent/.test(paint.bg)) failures.push('close: the button has no red wash behind it');
  if (rest === on) failures.push('close: hovering the button repaints nothing');

  await close.click();
  await page.waitForTimeout(400);
  if (await page.locator('[role="dialog"]').count()) failures.push('close: the X no longer dismisses the panel');
}

// The editable cells carry the same in-field steppers as the break threshold, so a
// click has to land in the data and not just in the box.
async function checkCellSteppers() {
  await page.keyboard.press('1');
  await page.waitForTimeout(300);
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

// `k-ink` is #F4F7FC in studio — white. It is the right colour for a heading and the
// wrong one for twenty rows of figures, so no cell may render its own text with it.
// Names are the exception the user asked for: prose reads better neutral than tinted.
async function checkInk() {
  const ALLOW_WHITE = ['agent'];
  for (const [key, view] of [['1', 'rundown'], ['2', 'rawCdr']]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(350);
    const white = await page.evaluate((allow) => {
      const probe = document.createElement('span');
      probe.style.color = 'rgb(var(--k-ink))';
      document.body.appendChild(probe);
      const ink = getComputedStyle(probe).color;
      probe.remove();
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
    }, ALLOW_WHITE);
    console.log(`ink ${view.padEnd(9)} white=${white.length}${white.length ? ` ${white.join(' ')}` : ''}`);
    if (white.length) failures.push(`${view}: ${white.length} cell value(s) still render in white k-ink — ${white.join(', ')}`);
  }
}


// Every column centres. Asserted per label, so a renamed column shows up as an
// unclassified one rather than being quietly skipped.
async function checkAlign() {
  await page.keyboard.press('1');
  await page.waitForTimeout(350);
  const cols = await page.evaluate(() =>
    [...document.querySelectorAll('main thead th')].map((th, i) => ({
      label: th.innerText.trim().toLowerCase(),
      head: getComputedStyle(th).textAlign,
      cell: getComputedStyle(document.querySelector(`main tbody tr > td:nth-child(${i + 1})`)).textAlign
    }))
  );
  const KNOWN = ['extension', 'agent', 'shift date', 'regions', 'calls', 'calls/hr', 'half', 'surveys', 'talk', 'span', 'breaks', 'total breaks', 'break time', 'net active', 'details'];
  console.log(`align  ${cols.map((c) => `${c.label}:${c.head}`).join(' ')}`);
  for (const c of cols) {
    if (c.head !== c.cell) failures.push(`align: "${c.label}" centres its header (${c.head}) but not its cells (${c.cell})`);
    if (c.head !== 'center') failures.push(`align: "${c.label}" reads ${c.head}, every column is meant to centre`);
  }
  const unknown = cols.filter((c) => !KNOWN.includes(c.label)).map((c) => c.label);
  if (unknown.length) failures.push(`align: unclassified column(s) ${unknown.join(', ')} — add them to KNOWN`);
}


// The complaint this guards: hover that is invisible, checkboxes that render as the
// native OS box, a Details column that can be switched off, and break stamps that
// wrap into a pile instead of a list. Each is measured, not eyeballed.
async function checkInteractions() {
  await page.keyboard.press('1');
  await page.waitForTimeout(400);

  const paint = (el) =>
    el.evaluate((node) => {
      const cs = getComputedStyle(node);
      return { border: cs.borderTopColor, bg: cs.backgroundColor, shadow: cs.boxShadow, color: cs.color };
    });

  // A state that repaints one property out of four is still a hover you cannot see.
  async function glow(name, loc) {
    const target = loc.first();
    if (!(await target.count())) {
      failures.push(`hover: no "${name}" element to measure`);
      return;
    }
    const idle = await paint(target);
    await target.hover();
    await page.waitForTimeout(220);
    const on = await paint(target);
    const changed = ['border', 'bg', 'shadow', 'color'].filter((k) => idle[k] !== on[k]);
    console.log(`hover ${name.padEnd(16)} ${changed.length ? changed.join(',') : 'NOTHING'}`);
    if (changed.length < 2) {
      failures.push(`hover: "${name}" repaints only ${changed.join(',') || 'nothing'}, still too subtle to notice`);
    }
    // The numbers say a state exists; this is the crop for judging whether it reads.
    const b = await target.boundingBox();
    if (b) {
      const x = Math.max(0, b.x - 24);
      const y = Math.max(0, b.y - 24);
      await shot(page, `${OUT}/hover-${name.replace(/[^\w-]+/g, '-').toLowerCase()}.png`, {
        clip: { x, y, width: Math.min(b.width + 48, VIEWPORT.width - x - 1), height: Math.min(b.height + 48, VIEWPORT.height - y - 1) }
      });
    }
  }

  const columns = page.getByRole('button', { name: /Columns/ });
  await glow('toolbar trigger', columns);
  await columns.click();
  await page.waitForTimeout(300);
  const menu = page.locator('.glass-menu').last();
  if (!(await menu.count())) {
    failures.push('columns: the Columns popover never opened');
    return;
  }

  await glow('menu item', menu.locator('.glow-hover'));

  const labels = await page.evaluate(() =>
    [...document.querySelectorAll('.glass-menu label > span')].map((s) => s.innerText.trim())
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
    const all = [...document.querySelectorAll('.glass-menu .cbox')];
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
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);

  // Rows are wide and stacked twenty deep, so they take a fill step rather than a
  // glow. Still has to be a step the eye can find. Measured with the popover closed:
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
  // written outside a layer, .glass-input silently outranked `focus:border-k-accent`
  // and `focus:outline-none` and every focused field looked unfocused.
  const search = page.locator('main input').first();
  const b0 = await search.evaluate((el) => getComputedStyle(el).borderTopColor);
  await search.focus();
  await page.waitForTimeout(150);
  const focused = await search.evaluate((el) => ({
    border: getComputedStyle(el).borderTopColor,
    outline: getComputedStyle(el).outlineStyle
  }));
  console.log(`focus  glass-input ${b0} -> ${focused.border} outline=${focused.outline}`);
  if (b0 === focused.border) failures.push('cascade: focusing a .glass-input leaves its border alone, a surface class is beating the utility again');
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
// the ring while every .glass-input next to it repaints its border.
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

// The selected scheme card has to look selected. It is the one place a state class
// can silently do nothing: .glass-card paints border/shadow outside any cascade
// layer, so a utility on the element loses to it and the card renders identical to
// its unselected siblings.
async function checkSchemeCard() {
  await page.keyboard.press('5');
  try {
    await page.waitForSelector('main .glass-card', { timeout: 8000 });
  } catch {
    failures.push('schemes: the settings view never rendered its cards');
    return;
  }
  const cards = page.locator('main .glass-card');
  if ((await cards.count()) < 2) {
    failures.push(`schemes: found ${await cards.count()} cards, expected one per colour scheme`);
    return;
  }
  const read = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('main .glass-card')].map((el) => {
        const cs = getComputedStyle(el);
        return {
          active: el.classList.contains('card-active'),
          label: (el.innerText || '').split('\n')[0].trim(),
          border: cs.borderTopColor,
          shadow: cs.boxShadow,
          fill: cs.backgroundImage,
          chip: (() => {
            // The marker is the row's last span; unselected cards have no marker.
            const row = el.querySelector('span');
            const c = row?.lastElementChild;
            return c && c !== row.firstElementChild ? getComputedStyle(c).backgroundColor : null;
          })()
        };
      })
    );

  const all = await read();
  const on = all.filter((c) => c.active);
  const off = all.filter((c) => !c.active);
  console.log(`schemes  cards=${all.length} active=${on.length} idleBorder=${off[0]?.border} activeBorder=${on[0]?.border}`);
  if (on.length !== 1) {
    failures.push(`schemes: ${on.length} cards claim to be active, exactly one should`);
    return;
  }
  const a = on[0];
  if (a.border === off[0].border) failures.push(`schemes: "${a.label}" has the same border as "${off[0].label}", the active state is not painting`);
  if (a.shadow === off[0].shadow) failures.push(`schemes: "${a.label}" has the same shadow as "${off[0].label}", no ring is painting`);
  if (a.fill === off[0].fill) failures.push(`schemes: "${a.label}" has the same fill as "${off[0].label}", no accent wash is painting`);
  if (!a.chip || a.chip === 'rgba(0, 0, 0, 0)') failures.push(`schemes: "${a.label}" has no filled Active marker`);

  // Negative control on the same node: strip the class and the paint must fall back.
  // Without this, an inert .card-active still passes by comparing against siblings.
  const idx = all.findIndex((c) => c.active);
  const bare = await cards.nth(idx).evaluate((el) => {
    el.classList.remove('card-active');
    const cs = getComputedStyle(el);
    const out = { border: cs.borderTopColor, shadow: cs.boxShadow, fill: cs.backgroundImage };
    el.classList.add('card-active');
    return out;
  });
  if (bare.border === a.border && bare.shadow === a.shadow && bare.fill === a.fill) {
    failures.push(`schemes: .card-active changes nothing on "${a.label}", the class is inert`);
  }

  // The lift on hover must not repaint the accent away.
  await cards.nth(all.findIndex((c) => c.active)).hover();
  await page.waitForTimeout(220);
  const hov = (await read())[all.findIndex((c) => c.active)];
  if (hov.border !== a.border) failures.push(`schemes: hovering "${a.label}" reverts its border to ${hov.border}`);
  await shot(page, `${OUT}/scheme-active.png`, { clip: { x: 0, y: 0, width: VIEWPORT.width, height: 620 } });
}

// The floating bar and its two action buttons. The bar must stay detached from the
// viewport and hold its offset while the page scrolls; the buttons carry colour from
// the active scheme, so their text has to clear AA in all six, not just the default.
async function checkChrome() {
  const rgba = (s) => {
    const n = s.match(/[\d.]+/g).map(Number);
    return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1];
  };
  const lum = (c) => {
    const f = (v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const read = (sel) =>
    page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const toRgba = (str) => {
        const m = str.match(/[\d.]+/g).map(Number);
        return [m[0], m[1], m[2], m.length > 3 ? m[3] : 1];
      };
      const layers = [];
      for (let n = el; n; n = n.parentElement) {
        const c = toRgba(getComputedStyle(n).backgroundColor);
        layers.push(c);
        if (c[3] >= 1) break;
      }
      const span = el.querySelector('span') ?? el;
      return { layers, text: getComputedStyle(span).color, label: (span.textContent || span.value || '').trim() };
    }, sel);

  const bar = page.locator('header.no-print');
  const box = await bar.boundingBox();
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
  if (box === null) failures.push('float: the header did not render');
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
  const buttons = { upload: 'header.no-print label', sample: 'header.no-print button[title]' };
  // Stack the translucent ancestors over the first opaque one, top down. Only the
  // fills are compared, so the accent wash in `background-image` is not counted:
  // the separation this asserts is the conservative floor of what the eye sees.
  const fillOf = (r) => {
    let bg = r.layers[r.layers.length - 1].slice(0, 3);
    for (let i = r.layers.length - 2; i >= 0; i--) {
      const [cr, cg, cb, ca] = r.layers[i];
      bg = [cr * ca + bg[0] * (1 - ca), cg * ca + bg[1] * (1 - ca), cb * ca + bg[2] * (1 - ca)];
    }
    return bg;
  };
  const between = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (hi + 0.05) / (lo + 0.05);
  };
  await page.keyboard.press('1');
  await page.waitForTimeout(250);
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
  for (const [id, scheme] of Object.entries(COLOR_SCHEMES)) {
    await page.evaluate(
      (vars) => vars.forEach(([name, triplet]) => document.documentElement.style.setProperty(name, triplet)),
      Object.entries(scheme.colors).map(([role, hex]) => [cssVarName(role), hexToRgbTriplet(hex)])
    );
    const parts = [];
    for (const [key, sel] of Object.entries(buttons)) {
      const r = await read(sel);
      if (!r) {
        parts.push(`${key}=MISSING`);
        failures.push(`contrast: ${id} has no "${key}" button to measure`);
        continue;
      }
      const cr = between(rgba(r.text), fillOf(r));
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
    const card = await read('main .panel, main .glass-card');
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

// The complaint was that a search bar never answered the pointer. Hover only has
// something to say while the field is not focused, so that is the state measured.
async function checkFieldHover() {
  for (const [key, view] of [
    ['1', 'rundown'],
    ['2', 'rawCdr']
  ]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(350);
    const field = page.locator('main input[type="search"]').first();
    if (!(await field.count())) {
      failures.push(`hover [${view}]: the toolbar has no search field to measure`);
      continue;
    }
    // The glow is the ask, so measure the shadow and not just the edge: a rule that
    // only recoloured the border would still pass a borderTopColor check.
    const read = () =>
      field.evaluate((el) => {
        const s = getComputedStyle(el);
        return { edge: s.borderTopColor, glow: s.boxShadow === 'none' ? 'none' : 'glow' };
      });
    const rest = await read();
    await field.hover();
    await page.waitForTimeout(150);
    const over = await read();
    await page.mouse.move(4, 4);
    await page.waitForTimeout(120);
    console.log(
      `hover ${view.padEnd(8)} ${rest.edge} ${rest.glow} -> ${over.edge} ${over.glow}`
    );
    if (rest.edge === over.edge || over.glow === 'none') {
      failures.push(
        `hover [${view}]: the search bar keeps its ${over.edge} border and ${over.glow} shadow, the pointer gets no answer`
      );
    }
  }
}

// The rundown toolbar is one flex line that wraps the moment its children outgrow the
// panel, and how wide those children are is data-dependent: "20/20" becomes "120/120",
// a wider name list, a longer date. So measure the line instead of trusting the width
// classes — one row, slack still left for the badges to grow into, and neither field
// so narrow it clips what it has to show.
async function checkToolbarFits() {
  await page.keyboard.press('1');
  await page.waitForTimeout(350);
  const m = await page.evaluate(() => {
    const bar = document.querySelector('main .panel');
    const cs = getComputedStyle(bar);
    const kids = [...bar.children];
    const pad = (side) => parseFloat(cs[`padding${side}`]);
    const inner = bar.clientWidth - pad('Left') - pad('Right');
    const used = kids.reduce((n, k) => n + k.getBoundingClientRect().width, 0) + (kids.length - 1) * parseFloat(cs.gap);
    const tallest = Math.max(...kids.map((k) => k.getBoundingClientRect().height));
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
    return {
      rows: Math.round((contentH + gap) / (tallest + gap)),
      slack: Math.round(inner - used),
      search: { need: textWidth(search, search.placeholder), room: room(search) },
      // The stepper overlay sits on top of the field's right edge, so its width comes
      // off the room the digits actually have.
      thresh: { need: textWidth(thresh, '120') + 13, room: room(thresh) }
    };
  });
  console.log(
    `fit rundown  rows=${m.rows} slack=${m.slack}px search=${m.search.need}/${m.search.room} thresh=${m.thresh.need}/${m.thresh.room}`
  );
  if (m.rows > 1) failures.push(`fit [rundown]: the toolbar wrapped to ${m.rows} rows, so Print/Export sit below the panel`);
  if (m.slack < 36) failures.push(`fit [rundown]: only ${m.slack}px of slack; the next badge that grows wraps the row`);
  for (const [name, box] of [['search', m.search], ['threshold', m.thresh]]) {
    if (box.need > box.room) failures.push(`fit [rundown]: the ${name} field clips its value, needs ${box.need}px in ${box.room}px`);
  }
}

// A `glow-hover` control takes its edge, wash and cast from --tone, which falls back
// to the accent. So a control with a coloured icon has to declare the same tone or
// hovering it lights the wrong hue — the popovers get this from FilterPopover, and
// Print is the one control that sets it by hand.
async function checkPrintTone() {
  await page.keyboard.press('1');
  await page.waitForTimeout(350);
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
  const tri = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).join(',');
  console.log(`print tone   icon=${tri(icon)} hover=${tri(edge)}`);
  if (tri(icon) !== tri(edge)) {
    failures.push(`print: the icon is rgb(${tri(icon)}) but hovering lights it rgb(${tri(edge)})`);
  }
}

// The range used to be two native <input type="date">: system chrome the six schemes
// cannot reach, and free to land on a date the file has no rows for. So assert the
// browser picker is gone, the panel that replaced it clears the toolbar under it, and
// the grid offers exactly the dates the data carries.
async function checkCalendar() {
  await page.keyboard.press('1');
  await page.waitForTimeout(350);
  await page.getByRole('button', { name: 'Custom', exact: true }).click();
  await page.waitForTimeout(250);
  const native = await page.locator('input[type="date"]').count();
  if (native) failures.push(`calendar: ${native} native date input(s) left in the page`);

  const trigger = page.locator('main button[aria-expanded]').filter({ hasText: '–' }).first();
  if (!(await trigger.count())) {
    failures.push('calendar: the title row has no range trigger');
    return;
  }
  await trigger.click();
  await page.waitForTimeout(250);
  const menu = trigger.locator('xpath=ancestor::div[1]').locator('.glass-menu');
  const box = await menu.boundingBox();
  if (!box) {
    failures.push('calendar: the range trigger never opened a panel');
    return;
  }
  const onTop = await page.evaluate(
    ([x, y]) => {
      const hit = document.elementFromPoint(x, y);
      return !!hit && !!hit.closest('.glass-menu');
    },
    [box.x + box.width / 2, box.y + box.height / 2]
  );
  if (!onTop) failures.push('calendar: the panel opens behind the toolbar under it');
  await shot(page, `${OUT}/calendar.png`, { clip: box });

  const cells = await menu.locator('button[aria-label^="20"]').evaluateAll((els) =>
    els.map((e) => ({ iso: e.getAttribute('aria-label'), off: e.disabled }))
  );
  const live = cells.filter((c) => !c.off).map((c) => c.iso);
  const datesIn = () =>
    page.evaluate(() => {
      const t = [...document.querySelectorAll('main span')]
        .map((s) => (s.textContent || '').trim())
        .find((x) => /^\d+ of \d+ dates$/.test(x));
      return t ? Number(t.match(/^(\d+)/)[1]) : -1;
    });
  const total = await datesIn();
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
  const inRange = await datesIn();
  console.log(`calendar pick  "${label}" dates=${inRange}`);
  if (!label.includes(live[0]) || !label.includes(live[live.length - 1])) {
    failures.push(`calendar: picking ${live[0]} then ${live[live.length - 1]} left the trigger reading "${label}"`);
  }
  if (inRange < 1) failures.push(`calendar: the range you picked selects ${inRange} dates`);
}

// The raw CDR report gained the rundown's extension filter. Selecting none has to
// actually empty the table, or the control is decoration.
async function checkRawCdrFilter() {
  await page.keyboard.press('2');
  await page.waitForTimeout(400);
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
  const shown = () =>
    page.evaluate(() => {
      const line = [...document.querySelectorAll('main span')]
        .map((s) => (s.textContent || '').trim())
        .find((t) => /^\d+ to \d+ of \d+$/.test(t));
      return line ? Number(line.match(/of (\d+)$/)[1]) : -1;
    });
  const trigger = page.locator('main button[aria-expanded]').filter({ hasText: /^Agents/ }).first();
  if (!(await trigger.count())) {
    failures.push('rawCdr: the toolbar has no Agents filter, extension filtering never landed here');
    return;
  }
  const before = await shown();
  await trigger.click();
  await page.waitForTimeout(280);
  const menu = trigger.locator('xpath=ancestor::div[1]').locator('.glass-menu');
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
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  console.log(`rawCdr filter  agents=${agents} rows ${before} -> none:${emptied} -> all:${refilled}`);
  if (agents > 0 && emptied !== 0) {
    failures.push(`rawCdr: deselecting every agent still matches ${emptied} calls, the filter is not applied`);
  }
  if (before >= 0 && refilled >= 0 && refilled !== before) {
    failures.push(`rawCdr: re-selecting every agent matches ${refilled} calls, was ${before}`);
  }
}

// The rail names every view in its button aria-label, so the page heading is checked
// against that rather than a hardcoded list: rename a view in one place and this fails
// instead of quietly agreeing with itself.
// The sample file carries one shift date, so a multi-day rundown cannot be reached
// through it. Seed a three-day fixture into a throwaway context instead of relaxing
// the assertion to "whatever the demo happens to contain".
async function checkDayGroups() {
  const DAYS = ['2026-10-05', '2026-10-06', '2026-10-07'];
  const records = [];
  DAYS.forEach((day, d) => {
    ['1042', '1043', '1044'].slice(0, d + 1).forEach((ext, i) => {
      for (let c = 0; c < 2; c++) {
        records.push({
          'CALL DATE (UTC)': `${day} 20:${String(15 + c * 30 + i).padStart(2, '0')}:00`,
          'END TIME (UTC)': `${day} 20:${String(25 + c * 30 + i).padStart(2, '0')}:00`,
          EXTENSION: ext,
          DIRECTION: 'OUT',
          RESPONSE: 'ANSWERED',
          DURATION: '600',
          REGION: 'North',
          CLID: '15596900000',
          DESTINATION: '1415000000'
        });
      }
    });
  });

  const ctx = await browser.newContext({ viewport: VIEWPORT });
  await ctx.addInitScript((rows) => {
    localStorage.setItem('cati_cdr_studio_raw_records', JSON.stringify(rows));
  }, records);
  const p = await ctx.newPage();
  p.on('console', (m) => {
    if (m.type() === 'error') failures.push(`console [days]: ${m.text()}`);
  });
  p.on('pageerror', (e) => failures.push(`pageerror [days]: ${e.message}`));
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.keyboard.press('1');
  await p.waitForTimeout(700);

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
  await shot(p, `${OUT}/rundown-days.png`, { fullPage: true });
  await trigger.click();
  await p.waitForTimeout(250);
  const menu = trigger.locator('xpath=ancestor::div[1]').locator('.glass-menu');
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

  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  if (await menu.count()) failures.push('days: Escape left the scope panel open');

  await trigger.click();
  await p.waitForTimeout(250);
  await menu.locator('button', { hasText: 'All dates' }).click();
  await p.waitForTimeout(350);
  if ((await bands()).length !== 3) failures.push('days: returning to All dates did not restore the per-shift bands');

  // The panel stays open after a pick, so dismiss it before the next view opens its own.
  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);

  const scopeTo = async (text) => {
    const trig = p.locator('main button[aria-expanded]').filter({ hasText: /All dates|2026-10/ }).first();
    await trig.click();
    await p.waitForTimeout(250);
    const m = trig.locator('xpath=ancestor::div[1]').locator('.glass-menu');
    await m.locator('button', { hasText: text }).click();
    await p.waitForTimeout(350);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(150);
  };

  // Raw CDR: the same split over the call log.
  await p.keyboard.press('2');
  await p.waitForTimeout(600);
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
  await p.keyboard.press('3');
  await p.waitForTimeout(1000);
  const tile = (label) =>
    p.evaluate((text) => {
      const card = [...document.querySelectorAll('main .glass-card')].find(
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
}

async function checkViewTitles() {
  const rail = await page.evaluate(() =>
    [...document.querySelectorAll('aside nav li button')].map((b) => b.getAttribute('aria-label') || '')
  );
  if (rail.length !== 5) {
    failures.push(`titles: the rail lists ${rail.length} views, expected 5`);
    return;
  }
  for (const label of rail) {
    const key = (label.match(/ \(([^)]+)\)$/) || [])[1];
    const name = key ? label.slice(0, -(key.length + 3)) : label;
    await page.keyboard.press(key);
    await page.waitForTimeout(450);
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
    if (t.text !== name) failures.push(`titles [${name}]: the page is titled "${t.text}", the rail calls it "${name}"`);
    if (!t.painted) failures.push(`titles [${name}]: the heading has no box, so it is not on screen`);
    if (t.desc.split(' ').length < 5) failures.push(`titles [${name}]: the subtitle is "${t.desc}", it explains nothing`);
  }
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
  // The keys are the hint, so they have to read off the collapsed strip with no
  // pointer involved at all. The nav's overflow-hidden is what would eat them.
  const unhovered = await page.evaluate(() => {
    const nav = document.querySelector('aside nav');
    const box = nav.getBoundingClientRect();
    return [...nav.querySelectorAll('li button')]
      .map((btn) => {
        const name = btn.getAttribute('aria-label');
        const hot = (name.match(/ \(([^)]+)\)$/) || [])[1];
        const key = [...btn.querySelectorAll('span')].find((s) => s.textContent.trim() === hot);
        if (!key) return `"${name}" renders no ${hot} on the strip`;
        const r = key.getBoundingClientRect();
        const cs = getComputedStyle(key);
        if (r.width < 2 || r.height < 2) return `"${name}" key is zero-sized`;
        if (r.left < box.left || r.right > box.right || r.top < box.top || r.bottom > box.bottom) {
          return `"${name}" key sits outside the rail and gets clipped`;
        }
        if (cs.visibility !== 'visible' || Number(cs.opacity) === 0) return `"${name}" key is invisible`;
        return null;
      })
      .filter(Boolean);
  });
  if (unhovered.length) {
    failures.push(`sidebar: ${unhovered.join(' | ')}`);
  }
  await shot(page, `${OUT}/sidebar-idle.png`);
  for (let i = 0; i < total; i++) {
    const item = items.nth(i);
    // With the strip frozen at 48px the aria-label is the only name the button
    // carries, so losing it would leave five anonymous glyphs.
    const aria = await item.locator('button').getAttribute('aria-label');
    if (!aria) {
      failures.push(`sidebar: rail item ${i} has no aria-label, the icon is unnameable while the strip stays collapsed`);
    }
    const label = aria || `item${i}`;
    await item.hover();
    // 120ms open delay plus a frame for the backdrop-filter layer to composite.
    await page.waitForTimeout(420);
    if (i === 0) {
      const wide = (await rail.boundingBox()).width;
      if (wide > 64) {
        failures.push(`sidebar: the rail grew to ${Math.round(wide)}px on hover, the hint is meant to open beside a strip that stays put`);
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
    // The card replaced the widened strip, so it has to carry both halves of what
    // the wide rail used to show inline: the view's name and its hotkey.
    if (aria) {
      const head = ((await card.first().evaluate((el) => el.querySelector('div').innerText)) || '')
        .replace(/\s+/g, ' ')
        .trim();
      const name = aria.replace(/ \(([^)]+)\)$/, '');
      const hot = (aria.match(/ \(([^)]+)\)$/) || [])[1];
      if (!hot || !head.includes(name) || !head.includes(hot)) {
        failures.push(`sidebar: the hint for "${aria}" reads "${head}", it should name the view and its key`);
      }
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
    await checkRings(view);
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
