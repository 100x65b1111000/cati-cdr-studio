// Five favicon/app-icon candidates, drawn as geometry on a 32-unit grid and rendered
// to _ui/icon-mockups.png at every size a browser actually asks for. The point of the
// sheet is the 16px column: a mark that only works at 128px is not an icon.
import { readFileSync, writeFileSync } from 'fs';
import { chromium } from 'playwright';

const INK = { plate1: '#16203A', plate2: '#070C16', edge: '#2E3E57', muted: '#2E4666', blue: '#3B82F6', cyan: '#22D3EE', amber: '#FBBF24' };

// The handset is Phosphor's own geometry, lifted out of the installed package: it is
// the same glyph the header tile already draws, so mark and UI cannot drift apart.
const PHONE = readFileSync('node_modules/@phosphor-icons/react/dist/defs/Phone.es.js', 'utf8').match(
  /\[\s*"fill",[\s\S]*?d: "([^"]+)"/
)[1];

const plate = (inner, fill = `url(#deep)`) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="deep" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${INK.plate1}"/><stop offset="1" stop-color="${INK.plate2}"/></linearGradient>
    <linearGradient id="hot" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${INK.blue}"/><stop offset="1" stop-color="#2563EB"/></linearGradient>
  </defs>
  <rect x=".8" y=".8" width="30.4" height="30.4" rx="8.5" fill="${fill}" stroke="${INK.edge}" stroke-width="1.6"/>
  ${inner}
</svg>`;

export const ICONS = [
  {
    file: 'icon-1-rundown',
    name: 'Rundown trace',
    why: 'The product in one image: a call trace over the shift histogram, the amber dot being the live call. The closest relative of the current mark, but banded so neither element crowds the other.',
    svg: plate(`
  <path d="M4.8 10.6h4.4l2.4-3.8 3.1 7 2.3-3.2h4.2" fill="none" stroke="${INK.cyan}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="24.6" cy="10.6" r="2.5" fill="${INK.amber}"/>
  <g stroke="${INK.blue}" stroke-width="3.8" stroke-linecap="round"><path d="M8.4 27v-5"/><path d="M16 27v-9"/><path d="M23.6 27v-3.4"/></g>`)
  },
  {
    file: 'icon-2-monogram',
    name: 'C for CATI',
    why: 'A letterform first, a data mark second: the gap in the C is where the call pulse enters. The most brandable of the five and the only one that survives being used without the word "Studio" next to it.',
    svg: plate(`
  <path d="M23.97 9.31A10.4 10.4 0 1 0 23.97 22.69" fill="none" stroke="${INK.blue}" stroke-width="3.7" stroke-linecap="round"/>
  <path d="M10.6 16h3.1l1.6-3.5 2.2 6.8 1.5-3.3h1.4" fill="none" stroke="${INK.cyan}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`)
  },
  {
    file: 'icon-3-handset',
    name: 'Knocked-out handset',
    why: 'Reverses the usual order — the tile is the icon, the handset is a hole in it — so it is the only candidate that keeps its shape on a light taskbar. The amber badge is the missed call.',
    svg: plate(`
  <path d="${PHONE}" fill="${INK.plate2}" transform="translate(1.5 1.5) scale(0.113)"/>
  <circle cx="25" cy="7" r="3.3" fill="${INK.amber}" stroke="${INK.plate2}" stroke-width="1.6"/>`, 'url(#hot)')
  },
  {
    file: 'icon-4-dial',
    name: 'Shift dial',
    why: 'Leads with the shift rather than the call: three quarters consumed in blue, the remainder in amber, the hub as the agent. Reads as a gauge at 16px because the ring is the only shape.',
    svg: plate(`
  <path d="M16 6.4A9.6 9.6 0 1 1 6.4 16" fill="none" stroke="${INK.blue}" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M6.4 16A9.6 9.6 0 0 1 16 6.4" fill="none" stroke="${INK.amber}" stroke-width="3.5" stroke-linecap="round"/>
  <circle cx="16" cy="16" r="2.6" fill="${INK.cyan}"/>`)
  },
  {
    file: 'icon-5-ledger',
    name: 'Record ledger',
    why: 'Three rows of a call-detail record, the top one live. The most literal reading of CDR; the stripe rhythm is what has to survive being drawn 16 pixels wide.',
    svg: plate(`
  <rect x="5.4" y="5.6" width="21.2" height="5.6" rx="2.8" fill="${INK.blue}"/>
  <rect x="5.4" y="13.2" width="14.4" height="5.6" rx="2.8" fill="${INK.muted}"/>
  <rect x="5.4" y="20.8" width="18" height="5.6" rx="2.8" fill="${INK.muted}"/>
  <circle cx="24.4" cy="16" r="2.6" fill="${INK.amber}"/>`)
  }
];

const sizes = [96, 48, 32, 24, 16];
const ramp = (bg) => (icon) =>
  sizes.map((s) => `<span class="cell ${bg}" style="width:${s + 18}px;height:${s + 18}px"><img src="${icon.file}.svg" width="${s}" height="${s}"></span>`).join('');

const html = `<!doctype html><meta charset="utf-8"><style>
  body { margin:0; background:#0B1220; color:#F4F7FC; font:13px/1.5 'Geist Variable', Inter, sans-serif; padding:28px 32px 40px; }
  h2 { font-size:15px; margin:26px 0 4px; letter-spacing:.02em; }
  p.note { color:#AFBCD2; margin:0 0 14px; }
  .row { display:flex; align-items:flex-end; gap:9px; margin-bottom:6px; }
  .cell { display:flex; align-items:center; justify-content:center; border-radius:9px; }
  .dark { background:#060A12; border:1px solid #1c2942; }
  .light { background:#EDEFF3; border:1px solid #d6dae2; }
  .card { padding:14px 16px 16px; border:1px solid #1c2942; border-radius:14px; background:#0E1626; margin-bottom:16px; }
  .ttl { font-weight:700; font-size:14px; }
  .why { color:#AFBCD2; max-width:1040px; margin:2px 0 14px; }
  .lbl { color:#7A8AA3; font-size:11px; text-transform:uppercase; letter-spacing:.09em; width:74px; flex:none; }
  .lock { display:flex; align-items:center; gap:11px; padding:9px 14px 9px 9px; border-radius:14px; background:#020509; border:1px solid #1c2942; width:max-content; }
  .lock img { width:34px; height:34px; border-radius:9px; }
  .lock b { display:block; font-size:15px; letter-spacing:-.01em; }
  .lock span { color:#AFBCD2; font-size:11px; }
  .tab { display:flex; align-items:center; gap:7px; padding:7px 26px 7px 10px; border-radius:9px 9px 0 0; background:#1B2536; font-size:12px; }
  .tab + .tab { background:#131C2B; color:#7A8AA3; }
  .tab img { width:16px; height:16px; }
  .strip { display:flex; gap:2px; align-items:flex-end; background:#0B1220; padding-top:16px; width:max-content; }
</style>
<h1 style="font-size:19px;margin:0 0 2px">Icon candidates</h1>
<p class="note">Each mark is shown at 96 / 48 / 32 / 24 / 16 px. The 16px column is the one that decides.</p>
${ICONS.map((i, n) => `<div class="card">
  <div class="ttl">${n + 1}. ${i.name}</div>
  <div class="why">${i.why}</div>
  <div class="row"><span class="lbl">Dark chrome</span>${ramp('dark')(i)}</div>
  <div class="row"><span class="lbl">Light</span>${ramp('light')(i)}</div>
  <div class="row" style="margin-top:14px"><span class="lbl">In place</span>
    <span class="lock"><img src="${i.file}.svg"><span><b>CATI CDR Studio</b><span>CDR Team Rundown &amp; Shift Intelligence</span></span></span>
    <span class="strip"><span class="tab"><img src="${i.file}.svg">CATI CDR Studio</span><span class="tab">Another tab</span></span>
  </div>
</div>`).join('')}
`;

writeFileSync('_ui/icon-mockups.html', html);
ICONS.forEach((i) => writeFileSync(`_ui/${i.file}.svg`, i.svg.trim() + '\n'));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 2 });
await page.goto(`file:///${process.cwd().replace(/\\/g, '/')}/_ui/icon-mockups.html`);
await page.waitForTimeout(400);
await page.screenshot({ path: '_ui/icon-mockups.png', fullPage: true });
await browser.close();
console.log(`wrote ${ICONS.length} svgs + _ui/icon-mockups.png`);
