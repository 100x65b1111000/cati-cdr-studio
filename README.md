# CATI CDR Studio

Call Detail Record (CDR) and agent performance analyzer for a CATI phone team. Next.js 16 (App Router), React 18, Tailwind CSS 4, Chart.js, SQLite. It runs as a Node server behind one shared team password, so a dropped export is visible to everyone on the floor instead of only to the browser that dropped it.

## Usage

Node 24 or newer: the database uses `node:sqlite`, which needs no flag there and no native
build anywhere. On 22.x the module is experimental and wants `--experimental-sqlite`.

```bash
cp .env.example .env.local   # APP_PASSWORD, SESSION_SECRET, optional DB_PATH
npm install
npm run dev      # http://localhost:3000
npm run build
npm start        # serve the build, the production mode
```

`APP_PASSWORD` gates the whole app and `SESSION_SECRET` signs the 12-hour session cookie, so
a request with a hand-written cookie is rejected. Signing out revokes the token itself, not
just the browser's copy of it, in a table beside the data it protects — a value left on a
shared machine stops working. With either variable missing the app fails closed: no password
matches, no token verifies. `DB_PATH` defaults to `data/cdr.sqlite`, which is created on boot
and never committed.

## What it does

Drop a CDR export (CSV) onto the window, or press **Sample data** for a synthetic team. Records are parsed and stored on the server; the view recalculates in the browser. Calls group into logical shift days, so a shift running 20:00 to 05:00 keeps overnight calls in one row instead of splitting them across two calendar dates.

Five views, each with its own URL, switched from the sidebar, the narrow-screen header or the keys `1` to `5`:

| View | URL | Contents |
|---|---|---|
| Rundown | `/rundown` | One row per agent per shift day: calls, answer rate, calls/hour, talk, breaks, net active, half dones, surveys. Sort, filter, edit, export, print. |
| Raw CDR | `/rawCdr` | Every parsed call record, filterable by response, sortable, paginated. |
| Analytics | `/analytics` | Four charts: volume and answer rate by agent, regional distribution, talk versus break minutes, hourly intensity. |
| Agents | `/directory` | Extension to name mapping, edited in place. Unmapped extensions show as their number. |
| Settings | `/settings` | Colour mode, shift rules, the dataset in use, earlier uploads, saved views, sign out. |

A link to any of those opens the same data on a colleague's machine. `Ctrl`+`K` (or `Cmd`+`K`) focuses the current view's search box.

### Date range

The date control sits under the metric strip. **All**, **Today**, **7d** are one-click presets; **Custom** takes an explicit from and to. It filters the metric strip, the rundown, the raw CDR list, every chart, and the agent detail modal. Dates are shift days, not calendar days.

### Saved views

The **Views** popover in the rundown toolbar stores the current date range, search, selected agents, visible columns, connected/missed mode, sort and page size under one name. The last-used filter set also restores automatically on reload.

### Columns and export

The Columns menu decides what the table shows and what Excel writes, in that order. The Connected/missed toggle changes both the cell and the export. CSV writes every agent-day regardless of column visibility, and JSON writes the full calculation including the per-break log.

## What is shared and what is not

Only the records live on the server. Everything else stays in this browser's `localStorage`:

| Where | Contents |
|---|---|
| Server (`data/cdr.sqlite`) | Every uploaded CDR as parsed call rows plus the raw CSV row, kept as upload history |
| Browser | Shift window and break threshold, extension-to-name map, half-done and survey overrides, colour mode, date range, saved views, last-used rundown filters |

**This has a consequence worth knowing:** two browsers can compute different numbers from the same records if their shift rules or extension maps differ. Promoting `shift_config` and `ext_map` to server truth is the obvious next step.

Uploads replace the dataset transactionally and the five most recent uploads are kept, so a wrong file is undone from **Settings → Earlier uploads** rather than by re-dropping it. Replacing shared data is the one genuinely destructive thing this app does, which is why the history exists.

## Theme

Two modes (Dark, Light) live in `src/theme/colorSchemes.js` as semantic roles, not raw colours:

```
page, sunken, surface, surface-hover
hairline, hairline-strong
ink, ink-muted, ink-faint
accent, accent-ink
success, danger, critical, warning
talk, throughput, break-time, region
```

`CdrContext` writes the active mode to `--k-<role>` variables on `<html>`, Tailwind exposes each one as a `k-*` utility, and Chart.js reads the same variables, so a mode change reaches the canvas without a second colour list. `danger` marks a missed call, `critical` marks a required field or destructive action, and the two never share a hex. `src/app/layout.jsx` inlines a classic script that resolves the stored mode before first paint, so a light choice does not flash dark on load; the same layout emits one rule per mode as a fallback for the server-rendered login page.

Print overrides the variables to paper and near-black ink in `src/index.css`. Interactive chrome is hidden by an explicit `.no-print` class on the sidebar, toolbars, pagination and toasts, and the printed page carries the view name and date range as a header. Charts are bitmaps, so printing from dark mode flips the mode to light first, which is the only thing that repaints them.

## CSV format

The server parses the upload with Papa and keeps every row it accepts, raw columns included, because the Raw CDR view shows fields the model does not name. `src/services/shiftCalculator.js` is the one parser — the browser and the server both call it, so header aliases and skip rules cannot drift apart. It matches these headers in upper or title case:

| Field | Accepted headers | Fallback |
|---|---|---|
| Extension | `EXTENSION`, `Extension`, `ext` | row skipped when empty |
| Start | `CALL DATE (UTC)`, `CALL DATE (Asia/Kolkata)`, `CALL DATE`, `Call Date` | row skipped when unparseable |
| End | `END TIME (UTC)`, `END TIME (Asia/Kolkata)`, `END TIME`, `End Time` | start plus `DURATION` in seconds |
| Direction | `DIRECTION`, `Direction` | `OUT` |
| Response | `RESPONSE`, `Response` | `ANSWERED` |
| Region | `REGION`, `Region` | `Unknown` |

Only `.csv` is accepted, up to 50MB. A wrong file type, a file with no rows, or a failed parse sets an error banner on the view rather than only a toast, and the preview modal shows the row count before you commit to the report.

## Checks

```bash
DB_PATH=data/test.sqlite npm run dev   # the harness uploads fixtures; do not point it at real data
node ui-check.mjs                      # Playwright: tokens, layering, overflow, focus, print, hotkeys
node check-metrics.mjs                 # the metric maths, against a generated dataset
node icon-mockups.mjs                  # favicon candidates at every size a browser asks for
```

`ui-check.mjs` is the behaviour oracle: it signs in with `APP_PASSWORD`, screenshots every view into `_ui/`, and exits non-zero when something is buried, clipped or throwing. Run it before and after a layout change.

## Layout

```
src/
  app/
    layout.jsx               Root HTML, fonts, pre-paint theme script, token fallback
    page.jsx                 Redirects to /rundown
    login/page.jsx           The shared password form
    (app)/layout.jsx         Client boundary: chrome plus CdrProvider for every route
    (app)/[view]/page.jsx    The URL segment picks the view out of NAV
    api/auth/                Sign in, sign out
    api/calls/               Records: read, upload, clear; /demo, /restore
  App.jsx                    Sidebar plus main column, keyboard shortcuts, modals
  Studio.jsx                 Provider around the app
  proxy.js                   Session check on every route (Next 16's middleware)
  index.css                  Tokens, .num, scrollbars, focus, print
  constants/defaultData.js   Default map, shift config, presets, regions
  context/CdrContext.jsx     All state, actions, the server dataset, localStorage effects
  hooks/useDismissOverlay.js Escape and backdrop dismissal
  lib/
    auth.js                  HMAC session token, password check (Edge-safe: no node:crypto)
    db.js                    node:sqlite singleton, schema, transactional replace, history
    ingest.js                Rows to stored calls, through the app's own parser
  services/
    shiftCalculator.js       CSV parse, shift grouping, idle break detection
    metrics.js               The Analytics metric chips
    demoDataGenerator.js     Synthetic dataset
    exportService.js         xlsx, csv, json
  theme/colorSchemes.js      Two colour modes as semantic roles
  utils/
    dateRange.js             Preset and range resolution
    timeFormatter.js         Durations
    storage.js               Prefixed localStorage
  components/
    layout/                  Sidebar, header, navConfig, DateRangeControl, DataActions
    dashboard/               MetricsStrip
    rundown/                 Table, toolbar, column model, EditCell
    raw-cdr/                 RawCDRTable
    analytics/               AnalyticsView
    directory/               AgentDirectory, AddAgentModal
    settings/                SettingsView
    modals/                  Agent detail, CDR preview, shift settings, dropzone
    ui/                      Modal, MetricStrip, SearchInput, SortHeaderCell,
                             FilterPopover, EmptyState, ErrorBanner, SkeletonRows
    common/                  Pagination, ToastContainer
```

Fonts are self-hosted through `@fontsource`. Icons are `@phosphor-icons/react`. No CDN links. Every figure uses the `.num` class, which is a monospace face with tabular numerals, so columns of digits align.

## Known debt

Next.js 16 warns that React 18 support goes away in Next 17, so the React 19 upgrade is due before that. The app is JavaScript on purpose: converting 5,700 lines mid-port would double the diff for no behaviour change.
