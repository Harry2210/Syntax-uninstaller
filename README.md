# Syntax Uninstaller

> **"Uninstall Clean. Maintain Smart. Stay in Control."**

![Syntax Uninstaller Logo](./public/logo.svg)

Syntax Uninstaller is a professional, modern Windows software management, uninstallation, cleanup, privacy, and system-maintenance desktop application. Built with **Tauri 2**, **Rust**, **React 19**, **TypeScript**, **Tailwind CSS**, and an embedded **SQLite** relational database, it provides the depth and power of tools like Revo Uninstaller while featuring its own visual identity, modular architecture, and safety-first design.

> **Brand assets:** `public/logo.svg` is the source of truth. Run
> `python scripts/generate_icons.py` after editing it to regenerate every
> Tauri/Windows icon (including the multi-size `.ico` embedded in the `.exe`).

---

## Key Highlights

- **Deliberately short sidebar**: six plain-English tools, one **All tools** entry that opens a searchable directory of everything else, and the four general destinations. No expandable trees, no modes.
- **Calm by design**: no radar sweeps, laser lines, pinging dots or shimmer beams during scans or long tasks — long operations show a plain status line and determinate progress instead.
- **Dark & light themes**: switch instantly from the sun/moon control next to the search box, or let the app follow the Windows theme (Settings → Appearance). An optional high-contrast mode is available too.
- **No console windows**: every helper process (PowerShell, `reg`, `winget`, `cmd`) is launched with `CREATE_NO_WINDOW`, so scans never flash black "cmd" windows over the UI.
- **Native Windows Integration**: Direct access to 64-bit and 32-bit Registry hives (`HKLM`, `HKCU`, `WOW6432Node`), Win32 Services, Task Scheduler, AppX/MSIX modern packages, and Volume Shadow Copies.
- **Deep 3-Tier Leftover Scanner**: Multi-signal leftover detection engine (`Safe`, `Moderate`, `Advanced`) evaluating registry keys, AppData, and ProgramData with transparent confidence ratings.
- **Automated Safety Backups**: Triggers Windows System Restore Points (`Checkpoint-Computer`) and exports `.REG` hive backups automatically before any destructive action.
- **Installation Monitor & Snapshot Tracing**: Captures before-and-after system state differentials during new software setups and allows complete trace reversal.
- **36 Fully Implemented Pages**: Every single button, search bar, filter, modal dialog, and tool performs its advertised function.
- **Read-only Disk Space Map**: New folder and file-type storage breakdown with safe drill-down, throttled progress, and a bounded parallel crawler that never follows junctions or deletes anything.
- **Visual Hunter Mode**: Drag or click a desktop crosshair to immediately inspect any window's process, PID, binary path, and launch uninstallation.
- **Health Score Diagnostic**: Transparent 0–100% health scoring for every desktop app to detect broken uninstallers and missing directories.
- **Fast by design**: Each page is a separate JavaScript chunk loaded on demand, every heavy registry/disk/PowerShell scan runs on a background thread, and slow scans are deferred until the interface is idle.

### Performance highlights

- Windows **Services** are enumerated through the native Service Control Manager instead of spawning PowerShell (about 9× faster).
- **Scheduled Tasks** use the native Task Scheduler COM API, avoiding a PowerShell process per scan.
- Junk, Windows, browser, and Office cleanup categories scan in parallel instead of one after another.
- Short TTL caches cover services, scheduled tasks, system specs, process lists, and Windows Store apps; write operations invalidate only the affected cache entries.
- Application icons are extracted once, cached, and de-duplicated across every list that shows them.
- The new **Disk Space Map** walks folders with a bounded eight-worker pool, throttled progress events, skip rules for junctions/symlinks, and a 45-second result cache.

---

## 36 Product Pages

| Section | Module | Core Functionality |
| :--- | :--- | :--- |
| **OVERVIEW** | **Dashboard** | Real-time RAM/Disk gauges, 8 live stat cards, health alerts, and quick actions |
| **UNINSTALLATION** | **All Programs** | Full desktop software manager with Details, Grid, and Compact views, search, filter, and export |
| | **Windows Apps** | Audit and remove modern UWP, AppX, and MSIX Store packages with AppX deployment |
| | **Forced Uninstall** | Deep trace purge for corrupted or broken applications with missing uninstallers |
| | **Quick Uninstall** | Automated silent removal using non-interactive switches (`/qn`, `/S`, `/VERYSILENT`) |
| | **Multiple Uninstall** | Sequential batch queue uninstallation preventing installer process collisions |
| | **Hunter Mode** | Visual window targeting crosshair to identify running processes and parent programs |
| | **Traced Programs** | Review recorded installation logs and completely revert captured system changes |
| | **Installation Monitor** | Pre- and post-installation system snapshots tracking registry and file modifications |
| | **Logs Database** | Offline removal knowledge base containing verified signatures and detection patterns |
| **MANAGEMENT** | **Startup Manager** | Optimize boot times by toggling Registry Run keys and Startup folders |
| | **Services Manager** | Win32 service inspector with start, stop, restart, and startup type management |
| | **Scheduled Tasks** | Audit and control recurring jobs registered in Windows Task Scheduler |
| | **Browser Extensions** | Inspect add-ons and manifest permissions across Chrome, Edge, and Firefox profiles |
| | **Process Manager** | Live task inspector with memory footprint (MB), CPU %, and safe termination controls |
| | **Software Updater** | Detect outdated packages through winget and apply silent background upgrades |
| | **Right-Click Menu Cleaner** | Audit and toggle Explorer context-menu handlers without registry guesswork |
| **CLEANUP** | **Junk Files Cleaner** | Safe disk sweeper for User Temp, Windows Temp, crash dumps, and error reports |
| | **Disk Space Map** | Read-only folder and file-type breakdown with safe drill-down and live scan progress |
| | **Windows Cleaner** | Privacy cleaner for recent document histories, Run dialog MRU, and explorer caches |
| | **Privacy Shield** | Disables diagnostic telemetry, Copilot/Recall indexing, and Start-menu web search |
| | **Browser Cleaner** | Clear bloated web caches, temporary assets, and download records across browsers |
| | **MS Office Cleaner** | Safely purge Office document sync caches (`OfficeFileCache`) without touching user documents |
| | **Evidence Remover** | Overwrite free unallocated drive clusters to prevent forensic restoration of deleted records |
| | **Secure Delete** | Irreversible multi-pass file shredder (1-pass zero fill, 3-pass DoD 5220.22-M, 7-pass random) |
| **TOOLS** | **All Tools** | Searchable directory of every page, grouped by task |
| | **Windows Tools** | Instant one-click launcher for 12 native Windows administration utilities |
| | **Locked File Unlocker** | Finds processes holding a file and schedules deletion on reboot when needed |
| | **PC Health Report** | Exports a self-contained HTML audit of software, hardware, and cleanup state |
| | **Registry Tools** | Safely inspect and export core application registration hives as `.REG` files |
| | **Backup Manager** | Centralized restoration center for archived Registry snapshots and System Restore points |
| | **System Information** | Hardware specs, Windows build, memory allocation, and mounted disk volume diagnostics |
| **GENERAL** | **Notifications** | Persistent audit trail and activity log of all executed operations and alerts |
| | **Help & Guide** | Beginner walkthrough, safety guidance, glossary, and keyboard shortcuts |
| | **Settings** | Configure default scan thoroughness, automated backup policies, and color themes |
| | **About Syntax** | Product architecture, core engine details, and software license information |

---

## Technology Stack

- **Desktop Framework**: Tauri 2
- **Backend Core**: Rust (with `rusqlite`, `winreg`, `sysinfo`, `chrono`, `uuid`, `walkdir`, plus native `windows`/`windows-sys` SCM and Task Scheduler COM bindings)
- **Frontend Architecture**: React 19, TypeScript, Vite (code-split, lazy routes)
- **Styling & Design System**: Tailwind CSS, Lucide React, Framer Motion
- **Database Engine**: Embedded SQLite in Write-Ahead Logging (WAL) mode
- **Operating System**: Windows 10 & Windows 11 (64-bit architecture)
- **Offline-first**: no external fonts, CDNs, or network calls at runtime — the UI uses the Windows system font stack and all data stays on the device

---

## Getting Started

### Prerequisites

1. **Node.js**: v18+ (v22+ recommended)
2. **Rust**: Rust toolchain (stable `x86_64-pc-windows-msvc` or `x86_64-pc-windows-gnu`)
3. **C++ Build Tools**: Visual Studio Community / C++ Build Tools or WinLibs MinGW

### Installation

```powershell
# Clone or navigate to the project directory
cd C:\Users\hario\.gemini\antigravity\scratch\syntax-uninstaller

# Install frontend dependencies
npm install
```

### Running the Application

```powershell
# Run the interactive frontend development server
npm run dev

# Build the production frontend distribution
npm run build

# Run the full native Windows desktop application with Tauri
npm run tauri dev

# Package production Windows desktop installer (.msi / .exe)
npm run tauri build
```

---

## Beginner Experience & Accessibility

- **Sidebar built around tasks, not terminology**: six "Everyday care" entries (Smart Care, Uninstall Apps, Clean Junk Files, Speed Up PC, Update Software, Privacy Shield), each with a one-line explanation, plus a single **All tools** page that lists everything by group with search.
- **Welcome tour** on first launch (replayable from Help & Guide).
- **Help & Guide page** (`help`): three-step quick start, plain-English glossary (registry, leftover, restore point…), safety promises, FAQ, troubleshooting, and the full shortcut list.
- **`Ctrl+K` command palette**: fuzzy-search all 36 pages by name, purpose or synonym ("disk space", "speed up", "privacy").
- **Feedback you can see**: every action emits a toast *and* a line in the Notification Center; engine failures raise a visible banner instead of an empty list.
- **Keyboard support**: visible focus rings everywhere, `Ctrl+K` search, `Ctrl+R` re-scan, `Esc` closes dialogs.
- **Reduced motion**: respects the Windows "Show animations" setting.
- **Dark / Light / Match Windows**: switch from the header or Settings; the choice is remembered and applied before the first paint.
- **High contrast**: optional stronger text/border contrast under Settings → Appearance.
- **Copyable text**: paths, logs and reports stay selectable even though the app chrome is not.

### Keyboard shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + K` | Search every tool |
| `Ctrl + R` | Re-scan the PC |
| `↑ / ↓` | Move through search results |
| `Enter` | Open the selected tool |
| `Esc` | Close search or dialog |

---

## Safety & Security Architecture

1. **Strict Path Protection**: The file cleaner and leftover scanner contain hardcoded safety boundaries that automatically block operations against Windows system trees (`C:\Windows`, `System32`) and drive roots (`C:\`, `D:\`).
2. **Defensive Pre-Checks**: Automatic System Restore Points and `.REG` hive backups are generated prior to running uninstallers or removing registry keys.
3. **Allowlisted IPC**: Communication between React and Rust is strictly restricted to typed, allowlisted command handlers. No arbitrary shell execution is permitted from the user interface.

---

## License

Proprietary — Developed for Syntax Software Labs. All rights reserved.
