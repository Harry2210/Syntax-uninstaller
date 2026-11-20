# Syntax Uninstaller — Architecture Specification

## 1. System Architecture Overview

Syntax Uninstaller is structured as a high-performance desktop application leveraging **Tauri 2**, a modular **Rust** backend engine, a reactive **React 19 / TypeScript** user interface, and an embedded **SQLite** relational knowledge store.

```
+---------------------------------------------------------------------------------+
|                       REACT 19 + TYPESCRIPT FRONTEND                            |
|  - 28 Dedicated Modules (Dashboard, All Programs, Forced Uninstall, etc.)       |
|  - Tailwind CSS + Custom Design System (Obsidian & Electric Violet)             |
|  - Real-time IPC Transport Layer (api.ts)                                       |
+---------------------------------------------------------------------------------+
                                       |
                           Secure Tauri 2 IPC Invoke
                                       |
+---------------------------------------------------------------------------------+
|                         MODULAR RUST BACKEND ENGINE                             |
|  +--------------------+  +--------------------+  +---------------------------+  |
|  | applications.rs    |  | leftover_scanner.rs|  | uninstaller.rs            |  |
|  | - HKLM/HKCU Reg    |  | - 3 Scanning Tiers |  | - Safe Execution Check    |  |
|  | - WOW64 32/64 Views|  | - Confidence Score |  | - Process Pre-checks      |  |
|  | - Health Scoring   |  | - Path Verification|  | - Restore Point Checkpoint|  |
|  +--------------------+  +--------------------+  +---------------------------+  |
|  +--------------------+  +--------------------+  +---------------------------+  |
|  | cleaner.rs         |  | system_info.rs     |  | backup.rs                 |  |
|  | - Junk Sweeper     |  | - Hardware Metrics |  | - .REG Export             |  |
|  | - Multi-pass Shred |  | - Disk Volumes     |  | - Restore Verification   |  |
|  +--------------------+  +--------------------+  +---------------------------+  |
+---------------------------------------------------------------------------------+
                                       |
                   Native Win32 APIs / SQLite Store / Registry
                                       |
+---------------------------------------------------------------------------------+
|                          OPERATING SYSTEM SUBSYSTEMS                            |
|  - Windows Registry (HKLM, HKCU, WOW6432Node)                                   |
|  - Windows Volume Shadow Copy / System Restore (Checkpoint-Computer)            |
|  - AppX / MSIX Deployment Service                                               |
|  - Windows Service Control Manager (Advapi32)                                   |
|  - Windows Task Scheduler (schtasks)                                            |
|  - Embedded SQLite (WAL mode, foreign keys, knowledge base signatures)           |
+---------------------------------------------------------------------------------+
```

## 2. Directory Structure

```
syntax-uninstaller/
├── src/
│   ├── assets/                 # Brand assets and custom SVG logos
│   ├── components/
│   │   ├── common/             # Reusable UI elements (StatCard, ConfirmationDialog, ProgressDialog, StatusBadge)
│   │   └── layout/             # Sidebar, Header, Breadcrumbs
│   ├── pages/                  # 28 fully implemented product modules
│   │   ├── DashboardPage.tsx
│   │   ├── AllProgramsPage.tsx
│   │   ├── WindowsAppsPage.tsx
│   │   ├── ForcedUninstallPage.tsx
│   │   ├── QuickUninstallPage.tsx
│   │   ├── MultipleUninstallPage.tsx
│   │   ├── HunterModePage.tsx
│   │   ├── TracedProgramsPage.tsx
│   │   ├── InstallationMonitorPage.tsx
│   │   ├── LogsDatabasePage.tsx
│   │   ├── StartupManagerPage.tsx
│   │   ├── ServicesManagerPage.tsx
│   │   ├── ScheduledTasksPage.tsx
│   │   ├── BrowserExtensionsPage.tsx
│   │   ├── ProcessManagerPage.tsx
│   │   ├── JunkCleanerPage.tsx
│   │   ├── WindowsCleanerPage.tsx
│   │   ├── BrowserCleanerPage.tsx
│   │   ├── OfficeCleanerPage.tsx
│   │   ├── EvidenceRemoverPage.tsx
│   │   ├── SecureDeletePage.tsx
│   │   ├── WindowsToolsPage.tsx
│   │   ├── RegistryToolsPage.tsx
│   │   ├── BackupManagerPage.tsx
│   │   ├── SystemInfoPage.tsx
│   │   ├── NotificationsPage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── AboutPage.tsx
│   ├── services/               # API bridge with dual native/fallback support
│   ├── styles/                 # Tailwind CSS styles and glass-panel effects
│   ├── types/                  # TypeScript interface definitions
│   ├── App.tsx                 # Root layout and reactive state manager
│   └── main.tsx                # React DOM entry point
├── src-tauri/
│   ├── src/
│   │   ├── commands/           # Tauri command dispatchers
│   │   ├── modules/            # Native Win32 / Rust implementation modules
│   │   │   ├── applications.rs # Registry application discovery & health scoring
│   │   │   ├── backup.rs       # .REG hive backups and recovery
│   │   │   ├── browser.rs      # Chrome/Edge/Firefox extension & cache audit
│   │   │   ├── cleaner.rs      # Temp file sweeper & multi-pass file shredder
│   │   │   ├── db.rs           # SQLite database schema, WAL mode, migrations
│   │   │   ├── leftover_scanner.rs # 3-Tier leftover engine
│   │   │   ├── monitor.rs      # Installation snapshot comparison
│   │   │   ├── processes.rs    # Process manager & sysinfo integration
│   │   │   ├── scheduled_tasks.rs # Task Scheduler API
│   │   │   ├── services.rs     # Windows Services Manager
│   │   │   ├── startup.rs      # Run / RunOnce & Startup folders
│   │   │   ├── system_info.rs  # OS, CPU, RAM, and Disk metrics
│   │   │   ├── tools.rs        # Built-in Windows admin tool shortcuts
│   │   │   ├── uninstaller.rs  # Safe uninstaller execution & process checks
│   │   │   └── windows_apps.rs # AppX / UWP / MSIX package manager
│   │   ├── lib.rs              # Tauri builder & command handler registration
│   │   └── main.rs             # Desktop executable entrypoint
│   ├── Cargo.toml              # Rust crate dependencies
│   └── tauri.conf.json         # Tauri 2 configuration
└── docs/                       # Architecture, security, and user documentation
```

## 3. Database Schema

Embedded SQLite operates in Write-Ahead Logging (WAL) mode for high concurrency:
- `uninstall_history`: Records executed uninstalls, status, duration, leftovers removed, and bytes freed.
- `backups`: Tracks exported `.reg` files and System Restore Point checkpoint markers.
- `installation_traces`: Stores before-and-after snapshot differentials captured by the Installation Monitor.
- `logs_database`: Pre-seeded and community knowledge base storing detection rules, silent uninstall arguments, and known leftover directories for major software packages.
- `settings`: Key-value configuration for user preferences and scanning parameters.
- `notifications`: Persistent activity log of operations, warnings, and system events.

---

## 4. Performance & Runtime Model

The application is optimised around one rule: **nothing heavy may run on the UI thread or block the first paint.**

### Frontend
- **Route-level code splitting** — every page is imported through `React.lazy()`, so the initial bundle only contains the shell, the sidebar and the dashboard. Each page becomes its own chunk, fetched the first time it is opened.
- **Suspense skeleton** — a layout-shaped `PageSkeleton` is shown while a chunk loads, so navigation never flashes a blank screen.
- **Staged data loading** — `getSystemSpecs`, `getInstalledApps` and `getProcesses` run immediately; the slower scans (PowerShell/AppX/task scheduler/browser extensions/junk walk) are deferred with `requestIdleCallback` so the window stays interactive.
- **Memoised derivations** — aggregate values (junk total, unread count) use `useMemo`; handlers passed to children use `useCallback`.
- **Vendor chunking** — React, Framer Motion and Lucide are emitted as separate long-lived chunks (`manualChunks`) for fast rebuilds and cache reuse.
- **Offline-first assets** — no external fonts or CDNs are referenced; the UI uses the Windows system font stack.

### Backend
- **Every I/O command is `async` + `spawn_blocking`** — Tauri executes synchronous commands on the main thread. Registry enumeration, PowerShell/`winget` child processes, disk walks and shredding are therefore dispatched to the blocking thread pool (`tauri::async_runtime::spawn_blocking`) so the WebView keeps painting.
- **Win32 over process spawning** — elevation is checked with `IsUserAnAdmin()` instead of spawning `net session`.
- **Bounded scans** — the quick directory-size estimator is capped (depth 2 / 500 files) so it cannot dominate startup.
- **No hot-path disk I/O** — the runtime event loop no longer writes a log line per event; logs are appended only on lifecycle events and are written to `%LOCALAPPDATA%\SyntaxUninstaller`.

### Feedback model
Every operation reports through a single `addNotification(title, message, level)` callback. It feeds both the persistent Notification Center (with unread state) and a transient toast stack, so success and failure are always visible. Native failures surface as a dashboard banner or an error toast instead of silently returning sample data.

### Child-process policy (`modules/winproc.rs`)
All external programs go through one helper instead of raw `std::process::Command`:

| Concern | Handling |
| :--- | :--- |
| Black console flashing | `CREATE_NO_WINDOW` creation flag on every child |
| Hung `winget` / PowerShell | hard timeout, child killed and reported |
| Deadlock on large output | stdout/stderr drained on reader threads |
| Command injection | `ps_string()` escapes values interpolated into PowerShell |
| `.msc` / `.exe` tools | `ShellExecuteW` — no `cmd.exe` wrapper at all |

Repeat queries (Windows services, scheduled tasks, WinGet inventory) pass through `modules/cache.rs`, a small TTL cache that is invalidated by the corresponding mutation, so the UI no longer spawns a burst of identical helper processes.

### Theming
`styles/index.css` defines the palette as CSS variables (`--c-background`, `--c-card`, `--c-primary`, …) for `html.dark` and `html.light`. `tailwind.config.js` maps every colour utility onto those variables with `<alpha-value>`, so one class works in both themes and switching is a single class toggle on `<html>` (performed by `services/preferences.ts` before the first paint).

### PowerShell ⇄ Rust JSON contract
Inventory data from PowerShell is parsed with `serde_json`. Two rules keep it reliable:

1. **Keys are declared explicitly** in the script (`@{Name='display_name';Expression={…}}`). `ConvertTo-Json` preserves the property names PowerShell produces (PascalCase), while the Rust structs are snake_case — a mismatch silently produced empty lists.
2. **Nulls are tolerated.** A property can be `null` on a single object, and `#[serde(default)]` only covers *missing* keys, so `modules/serde_util.rs` provides `string_or_default` / `bool_or_default` deserializers used by `WinService`, `ScheduledTaskItem` and `WindowsApp`.

### Store (MSIX) applications
Claude, WhatsApp and other modern installers ship as MSIX packages that never appear in the classic `Uninstall` registry keys. `services/appMerge.ts` maps a `WindowsApp` into an `InstalledApp`, so the Uninstaller lists both inventories together; entries carry `package_full_name`, are tagged **STORE**, and are removed through `Remove-AppxPackage` instead of `run_uninstaller`.

### Brand assets
`public/logo.svg` is the single source of truth for the mark (rounded gradient tile, white "S" sweep, spark). `scripts/generate_icons.py` rasterises it into every Tauri / Windows icon size, including the multi-resolution `icon.ico` embedded in the executable.

---

## 5. Frontend Routes

| Area | Pages |
| :--- | :--- |
| Overview | `dashboard` |
| Uninstaller workspace | `all-programs`, `windows-apps`, `quick-uninstall`, `multiple-uninstall`, `forced-uninstall`, `hunter-mode`, `installation-monitor`, `traced-programs`, `logs-database` |
| Clean & privacy | `junk-cleaner`, `windows-cleaner`, `privacy-debloater`, `browser-cleaner`, `office-cleaner`, `evidence-remover`, `secure-delete` |
| Optimization | `startup-manager`, `software-updater`, `context-menu`, `process-manager`, `services-manager`, `scheduled-tasks`, `browser-extensions` |
| Tools & recovery | `windows-tools`, `file-unlocker`, `system-report`, `registry-tools`, `backup-manager`, `system-info` |
| General | `notifications`, `help`, `settings`, `about` |

Page titles, subtitles and search keywords are defined once in `src/data/pages.ts` and consumed by the header, the `Ctrl+K` command palette and the Help page.
