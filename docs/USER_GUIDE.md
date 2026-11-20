# Syntax Uninstaller — User & Administrator Guide

## Overview

Syntax Uninstaller is a professional Windows desktop software management and maintenance suite. It combines deep Registry scanning, automated installation tracing, real-time hardware diagnostics, and safe system cleanup in an intuitive dark-themed interface.

---

## Getting Started

On first launch a four-step welcome tour explains what the app does and how it keeps you safe. It can be replayed at any time from **Help & Guide** in the sidebar.

### One interface, nothing hidden

The sidebar is organised by task, not by jargon:

| Sidebar area | What is inside |
| :--- | :--- |
| **Everyday care** (top) | Smart Care, Uninstall Apps, Clean Junk Files, Speed Up PC, Update Software, Privacy Shield — each with a one-line description |
| **All tools** | One page listing every other tool by group, with a search box |
| **Bottom bar** | Notifications, Help & Guide, Settings, About |

Inside a workspace, the tab strip under the header switches between that workspace's tools. If you cannot find something, press **Ctrl + K** and type what you want to do.

### Three everyday routines

1. **Uninstall Apps** → pick a program → *Uninstall*. Syntax runs the official uninstaller, then offers to remove the leftovers it left behind.
2. **Clean Junk Files** → review the categories → *Clean*. Only temporary caches are touched, never documents.
3. **Speed Up PC** → disable startup programs you do not need. Nothing is deleted; you can re-enable them.

### Finding any tool

Press **Ctrl + K** and type what you want to do — `uninstall`, `disk space`, `privacy`, `startup`. Results include a one-line explanation of each tool.

### Safety rules

- Destructive actions always ask for confirmation (configurable in Settings).
- A System Restore Point and a `.REG` backup are created before risky operations.
- Windows system paths (`System32`, drive roots) are hard-blocked from deletion.
- Everything you run is recorded in the Notification Center; visiting it marks entries as read.
- Settings are stored on this device only — nothing is uploaded.

### Changing the look

Use the **sun / moon switch just left of the search box** to flip between light and dark instantly. For "Match Windows", a stronger high-contrast mode, or scanner defaults, open **Settings** — every change is saved automatically.

### Keyboard shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + K` | Search every tool |
| `Ctrl + R` | Re-scan the PC |
| `↑ / ↓` | Move through search results |
| `Enter` | Open the selected tool |
| `Esc` | Close search or dialog |

---

## Uninstallation Modules

### 1. All Programs
- **Discovery**: Automatically scans 64-bit and 32-bit Windows Registry hives (`HKLM`, `HKCU`, and `WOW6432Node`).
- **Health Score**: Computes an automated score (0–100%) for each program based on installation folder validity, uninstaller executable availability, and publisher verification.
- **Views**: Toggle seamlessly between Details View, Grid View, and Compact List View.
- **Actions**: Perform standard uninstallation (with automatic restore point), silent quick uninstall, or inspect registry keys and health notes.

### 2. Windows Apps
- Manages Modern Universal Windows Platform (UWP) and AppX/MSIX packages.
- Reset isolated application state or safely uninstall packages for the current user.
- Core operating system components are clearly labeled as protected.

### 3. Forced Uninstaller
- For applications with damaged, corrupted, or completely missing uninstallers.
- Enter an application name or directory to initiate a multi-tier scan of all associated registry keys and AppData/ProgramData folders.
- Requires explicit user confirmation and exports an automated safety `.REG` backup prior to deletion.

### 4. Quick Uninstall
- Immediately invokes non-interactive/silent uninstaller switches (`/qn`, `/S`, `/VERYSILENT`).
- Automatically scans and sweeps safe leftover traces without manual wizard clicking.

### 5. Multiple Uninstall (Batch Queue)
- Select multiple applications and process the queue sequentially.
- Uninstaller processes are never run concurrently to prevent installer race conditions or locked shared files.

### 6. Hunter Mode
- Interactive desktop crosshair targeting.
- Hover over any open window or tray icon to inspect its process name, PID, and executable path, with immediate options to terminate or trace its installed application.

### 7. Installation Monitor & Traced Programs
- **Pre-Install Snapshot**: Captures a baseline scan of registry run keys, installed packages, and program directories.
- **Post-Install Diff**: Identifies new keys and files created by an installer and saves the trace to the local SQLite database.
- **Traced Reversal**: Reverts the exact tracked changes to return the system to its pre-installation state.

### 8. Removal Logs Database
- Knowledge base of verified removal signatures, silent flags, and detection rules for major software packages.
- Functions offline with support for digital signature synchronization.

---

## System Management Modules

### 9. Startup Manager
- Catalogs registry `Run` and `RunOnce` keys (User & Machine) and physical Startup folders.
- One-click toggle switch to safely disable startup items without deleting configuration.
- Flags broken startup entries pointing to non-existent executables.

### 10. Windows Services Manager
- Inspects Win32 background services, startup types (Automatic, Manual, Disabled), and real-time states (Running/Stopped).
- Start, stop, or restart services directly from the console.

### 11. Scheduled Tasks
- Enumerates active background jobs registered in Windows Task Scheduler.
- Enable or disable recurring updaters and telemetry tasks.

### 12. Browser Extensions Manager
- Audits installed add-ons and extensions across Google Chrome, Microsoft Edge, and Mozilla Firefox.
- Inspects extension manifest versions, permissions, and profile locations.

### 13. Process Manager
- Live process monitor detailing CPU utilization and memory footprint (MB).
- Critical Windows processes (`explorer.exe`, `csrss.exe`, etc.) are protected against accidental termination.

---

## System Cleanup & Privacy Modules

### 14. Junk Files Cleaner
- Scans User Temp (`%TEMP%`), Windows Temp (`C:\Windows\Temp`), application crash dumps (`.dmp`), and Windows Error Reporting (WER) logs.
- Safe deletion engine skips locked or currently in-use files.

### 15. Windows Privacy Cleaner
- Cleans recent document history, File Explorer run dialog history, and thumbnail caches.

### 16. Browser Data Cleaner
- Clears web caches and history across Chrome, Edge, and Firefox to reclaim gigabytes of disk space.

### 17. MS Office Cleaner
- Safely purges temporary synchronization caches (`OfficeFileCache`) and recent document shortcuts without affecting actual user files or document templates.

### 18. Evidence Remover & Secure Delete
- **Evidence Remover**: Sanitizes free unallocated disk space using pseudorandom overwrite patterns to prevent forensic recovery of deleted records.
- **Secure Delete**: Overwrites selected files with 1-pass (Zero fill), 3-pass (DoD 5220.22-M), or 7-pass random data before filesystem unlinking.

---

## Administration & Recovery Tools

### 19. Windows Administration Toolbox
- One-click launcher for built-in administrative utilities: Task Manager, Disk Cleanup, Services, Device Manager, Disk Management, Event Viewer, Resource Monitor, System Restore GUI, and Registry Editor.

### 20. Registry Utilities
- Inspects standard application registration hives and allows users to export and backup custom subkeys as `.REG` files.

### 21. Backup & Recovery Center
- Centralized management of exported Registry snapshots and Windows System Restore points.
- Instant one-click restoration of archived `.REG` files.

### 22. System Information
- Real-time diagnostic overview of operating system build, CPU architecture, physical and available RAM, and mounted storage volume capacities.
