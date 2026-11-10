# CATI CDR Studio

Call Detail Record (CDR) and agent performance analyzer for a CATI phone team. Built with Next.js 16 (App Router), React 18, Tailwind CSS 4, and Chart.js. Runs entirely in the browser as a static web application deployable directly to **GitHub Pages** with zero backend or database required.

---

## Quick Start

```bash
npm install
npm run dev        # Local development on http://localhost:3000
npm run build      # Produces the static export in out/
```

To preview the production static export locally:
```bash
npx serve out
```

---

## Deployment to GitHub Pages

The repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically builds and deploys the static site whenever changes are pushed to `main` or `master`.

### One-Time Setup on GitHub:
1. Push your repository to GitHub.
2. In your GitHub repository, open **Settings** → **Pages**.
3. Under **Build and deployment** → **Source**, select **GitHub Actions**.
4. The deployment will trigger and publish your app to `https://<username>.github.io/<repository-name>/`.

---

## Features

Drop any standard CDR export (CSV) onto the window, or click **Upload CDR CSV** at the bottom of the sidebar. First-time visitors automatically load a synthetic CATI team dataset, so views are never blank.

### Views

| View | Path | Description |
|---|---|---|
| **Rundown** | `/rundown` | Agent-by-day metrics: call counts, connect/answer rates, dials/hour, talk time, break timestamps, net active time, and survey counts. Supports in-line editing, column customization, and print layouts. |
| **Raw CDR** | `/rawCdr` | Searchable, filterable, and paginated table of every individual call record from the uploaded CSV. |
| **Analytics** | `/analytics` | Operational visualizations: dial volume vs. answer rates, hourly call intensity, regional call distribution, and talk vs. break durations. |
| **Agents** | `/directory` | Phone extension-to-agent name mappings with editable rosters and individual agent performance sheets. |
| **Settings** | `/settings` | Shift configuration (overnight shift rollover windows, break thresholds), dataset status, upload history rollback, saved views, and theme toggles. |

* Keyboard shortcuts: Press `1` through `5` to switch views. Press `Ctrl`+`K` (or `Cmd`+`K`) to focus search.

---

## Architecture & Data Storage

* **100% Client-Side**: All parsing, shift calculations, metrics aggregations, and report exports run in the user's browser. No data leaves the machine.
* **Storage (`localStorage`)**:
  * Uploaded datasets and up to 5 historical uploads (for one-click rollback).
  * Shift configuration & break thresholds.
  * Extension-to-agent name mapping roster.
  * Saved rundown views, date range presets, color mode, and animation preferences.
* **Overnight Shift Handling**: Shifts spanning across midnight (e.g., 20:00 to 05:00) cleanly group calls into a single logical shift day.
* **Exports**: Download reports in Excel (`.xlsx`), CSV (`.csv`), or detailed JSON (`.json`) filtered by the active date range.

---

## CSV Format Support

The parser (`src/services/shiftCalculator.js`) accepts standard CDR CSV exports up to 50MB and matches the following header variations (case-insensitive):

| Field | Accepted Headers | Default / Fallback |
|---|---|---|
| **Extension** | `EXTENSION`, `Extension`, `ext` | Row skipped if blank |
| **Call Start** | `CALL DATE (UTC)`, `CALL DATE (Asia/Kolkata)`, `CALL DATE`, `Call Date` | Row skipped if unparseable |
| **Call End** | `END TIME (UTC)`, `END TIME (Asia/Kolkata)`, `END TIME`, `End Time` | `Start Time` + `DURATION` (sec) |
| **Direction** | `DIRECTION`, `Direction` | `OUT` |
| **Response** | `RESPONSE`, `Response` | `ANSWERED` |
| **Region** | `REGION`, `Region` | `Unknown` |

---

## Project Structure

```
src/
  app/
    layout.jsx               Root layout, theme initialization script, fonts
    page.jsx                 Client redirect to /rundown
    (app)/
      layout.jsx             Dynamic client boundary wrapping CdrProvider
      [view]/                Dynamic static page generator (rundown, rawCdr, analytics, directory, settings)
  components/
    analytics/               Analytics charts (Chart.js)
    common/                  Pagination, toast notifications
    dashboard/               Top metric summary strip
    directory/               Agent roster and detail modals
    layout/                  Sidebar, header, mobile navigation, data actions
    modals/                  CSV upload preview, shift configuration, agent details
    raw-cdr/                 Raw CDR table and filter controls
    rundown/                 Agent shift rundown table and toolbars
    settings/                Settings view and dataset manager
    ui/                      Atomic UI components (buttons, popovers, glyphs)
  context/
    CdrContext.jsx           Central client state: datasets, preferences, and calculations
  services/
    demoDataGenerator.js     Synthetic team CDR generator
    exportService.js         Excel, CSV, and JSON exporters
    metrics.js               Summary metric math
    shiftCalculator.js       CSV parsing, shift alignment, and break detection
  theme/
    colorSchemes.js          Dark and light semantic color palettes
  utils/
    dateRange.js             Shift-aware date range filtering
    motion.js                Reduced motion detection
    storage.js               Safe prefixed localStorage helpers
    timeFormatter.js         Duration and timestamp formatters
.github/
  workflows/
    deploy.yml               GitHub Pages automated deployment workflow
server-backend/              Preserved original Node.js & SQLite server files (optional reference)
```
