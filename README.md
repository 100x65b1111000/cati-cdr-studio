# CATI CDR Studio

Call Detail Record (CDR) and agent performance analyzer for a CATI phone team. React 18, Vite, Tailwind CSS 3, Chart.js. Single user, runs entirely in the browser, no backend.

## Usage

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # static bundle in dist/
npm run preview  # serve the built bundle
```

## What it does

Drop a CDR export (CSV) onto the window, or press **Load sample data** in the sidebar for a synthetic team. The tool groups calls into logical shift days, so a shift running 20:00 to 05:00 keeps overnight calls in one row instead of splitting them across two calendar dates.

Five views, switched from the sidebar or the keys `1` to `5`:

| View | Contents |
|---|---|
| Rundown | One row per agent per shift day: calls, answer rate, calls/hour, talk, breaks, net active, half dones, surveys. Sort, filter, edit, export, print. |
| Raw CDR | Every parsed call record, filterable by response, sortable, paginated. |
| Analytics | Four charts: volume and answer rate by agent, regional distribution, talk versus break minutes, hourly intensity. |
| Agents | Extension to name mapping, edited in place. Unmapped extensions show as their number. |
| Settings | Colour scheme, shift rules, a summary of loaded data, saved views. |

`Ctrl`+`K` (or `Cmd`+`K`) focuses the current view's search box.

### Date range

The date control sits under the metric strip. **All**, **Today**, **7d** are one-click presets; **Custom** takes an explicit from and to. It filters the metric strip, the rundown, the raw CDR list, every chart, and the agent detail modal. Dates are shift days, not calendar days.

### Saved views

The **Views** popover in the rundown toolbar stores the current date range, search, selected agents, visible columns, connected/missed mode, sort and page size under one name. The last-used filter set also restores automatically on reload.

### Columns and export

The Columns menu decides what the table shows and what Excel writes, in that order. The Connected/missed toggle changes both the cell and the export. CSV writes every agent-day regardless of column visibility, and JSON writes the full calculation including the per-break log.

## Theme

Five schemes (Kanagawa, Gruvbox, Tokyo Night, Catppuccin, Evergreen) live in `src/theme/colorSchemes.js` as semantic roles, not raw colours:

```
page, sunken, surface, surface-hover
hairline, hairline-strong
ink, ink-muted, ink-faint
accent, accent-ink
success, danger, critical
talk, throughput, break-time, region
```

`CdrContext` writes the active scheme to `--k-<role>` variables on `<html>`, Tailwind exposes each one as a `k-*` utility, and Chart.js reads the same variables, so a theme change reaches the canvas without a second colour list. `danger` marks a missed call, `critical` marks a required field or destructive action, and the two never share a hex.

Print overrides the variables to paper and near-black ink in `src/index.css`. Interactive chrome is hidden by an explicit `.no-print` class on the sidebar, toolbars, pagination and toasts, and the printed page carries the view name and date range as a header.

## CSV format

`src/services/shiftCalculator.js` matches these headers in upper or title case:

| Field | Accepted headers | Fallback |
|---|---|---|
| Extension | `EXTENSION`, `Extension`, `ext` | row skipped when empty |
| Start | `CALL DATE (UTC)`, `CALL DATE (Asia/Kolkata)`, `CALL DATE`, `Call Date` | row skipped when unparseable |
| End | `END TIME (UTC)`, `END TIME (Asia/Kolkata)`, `END TIME`, `End Time` | start plus `DURATION` in seconds |
| Direction | `DIRECTION`, `Direction` | `OUT` |
| Response | `RESPONSE`, `Response` | `ANSWERED` |
| Region | `REGION`, `Region` | `Unknown` |

Only `.csv` is accepted. A wrong file type, a file with no rows, or a failed parse sets an error banner on the view rather than only a toast, and the preview modal shows the row count before you commit to the report.

## Persistence

Everything is `localStorage` under the `cati_cdr_studio_` prefix, with no sync and no server copy:

| Key | Contents |
|---|---|
| `raw_records` | Parsed call records |
| `shift_config` | Shift window and break threshold |
| `ext_map` | Extension to name map |
| `manual_overrides` | Half dones and surveys per agent-day |
| `color_scheme` | Active theme |
| `date_range` | Last date range |
| `saved_views` | Named filter sets |
| `view_state` | Last-used rundown filters |

Clear the site's storage to start over.

## Layout

```
src/
  App.jsx                     Sidebar plus main column, keyboard shortcuts
  main.jsx                    Fonts, theme variables, root mount
  index.css                   Tokens, .num, scrollbars, focus, print
  constants/defaultData.js    Default map, shift config, presets, regions
  context/CdrContext.jsx      All state, actions, localStorage effects
  hooks/useDismissOverlay.js  Escape and backdrop dismissal
  services/
    shiftCalculator.js        CSV parse, shift grouping, idle break detection
    demoDataGenerator.js      Synthetic dataset
    exportService.js          xlsx, csv, json
  theme/colorSchemes.js       Five schemes as semantic roles
  utils/
    dateRange.js              Preset and range resolution
    timeFormatter.js          Durations
    storage.js                Prefixed localStorage
  components/
    layout/                   Sidebar, DateRangeControl
    dashboard/                MetricsStrip
    rundown/                  Table, toolbar, column model, EditCell
    raw-cdr/                  RawCDRTable
    analytics/                AnalyticsView
    directory/                AgentDirectory, AddAgentModal
    settings/                 SettingsView
    modals/                   Agent detail, CDR preview, shift settings, dropzone
    ui/                       Modal, MetricStrip, SearchInput, SortHeaderCell,
                              FilterPopover, EmptyState, ErrorBanner, SkeletonRows
    common/                   Pagination, ToastContainer
```

Fonts are self-hosted through `@fontsource-variable/geist` and `@fontsource/jetbrains-mono`. Icons are `@phosphor-icons/react`. No CDN links. Every figure uses the `.num` class, which is JetBrains Mono with tabular numerals, so columns of digits align.
