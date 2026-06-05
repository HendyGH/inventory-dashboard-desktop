# Inventory Dashboard — Desktop (.exe)

A standalone Windows desktop app for **offline inventory reconciliation and operational performance tracking**. Packaged with Electron — runs fully offline, all data stays local on the machine.

Built from a single-page HTML dashboard into a polished desktop application with custom titlebar, splash screen, glassmorphism UI, toast notifications, and keyboard shortcuts.

## Features

- **100% Offline** — No internet required. Zero external dependencies.
- **Multi-Shift Data Ingestion** — Paste raw tabular data from Excel/EWM for each shift
- **Reconciliation Engine** — Maps physical scans vs system balance using composite keys (Bin + SKU + Lot)
- **5 Status Categories** — Matched, Qty Mismatch, Placement Mismatch, Not Scanned, Issued/Outbound
- **Auditor Performance Matrix** — Track accuracy, duplicates, duration, missed scans per user
- **KPI Exclusion Engine** — Forgive specific errors with Shift+Click multi-select
- **Custom SVG Charts** — Donut charts + dual-axis trend graphs (no Chart.js dependency)
- **CSV Export** — Export filtered views with remarks and exclusion status
- **Dark/Light Theme** — Toggle with button or `Ctrl+D`
- **Persistent Storage** — localStorage saves all data across sessions
- **Custom Titlebar** — Frameless window with themed controls
- **Splash Screen** — Professional loading screen on startup

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+D` | Toggle dark/light mode |
| `Ctrl+R` | Run pipeline engine |
| `Ctrl+E` | Export CSV |
| `Escape` | Exit fullscreen table view |

## Download

Grab the latest `InventoryDashboard-<version>-portable.exe` from the [**Releases**](../../releases) page.

It's portable — no installation needed, just double-click to run.

## Build It Yourself

Requires [Node.js](https://nodejs.org) 18+.

```bash
npm install
npm start              # run in dev mode
npm run dist-portable  # build single portable .exe
npm run dist-dir       # build unpacked folder
npm run dist-all       # build both
```

Output goes to the `dist/` folder.

## Automated Builds (GitHub Actions)

A workflow (`.github/workflows/build-windows.yml`) builds the `.exe` on a Windows runner and attaches it to a Release when you push a version tag:

```
v1.0.0 → triggers build → .exe appears in Releases
```

You can also trigger the workflow manually from the **Actions** tab.

## Project Structure

```
.
├── main.js                    # Electron main process (frameless window, splash, IPC)
├── preload.js                 # Context bridge for titlebar controls
├── package.json               # Electron + electron-builder config
├── build/
│   ├── icon.ico               # App icon (Windows)
│   └── icon.svg               # Source SVG icon
├── app/
│   ├── index.html             # Main app UI with custom titlebar
│   ├── splash.html            # Splash/loading screen
│   ├── css/styles.css         # Polished stylesheet (glassmorphism, animations)
│   └── js/renderer.js         # All app logic, pipeline engine, charts
├── scripts/
│   └── generate-icon.js       # SVG → ICO conversion script
├── .github/workflows/
│   └── build-windows.yml      # CI: auto-build exe on tag push
├── LICENSE
└── .gitignore
```
