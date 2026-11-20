# Syntax Uninstaller — Security & Safety Model

## 1. Principles of Safe Software Removal

Syntax Uninstaller is built with strict defensive controls to prevent system corruption, accidental data loss, or unsafe file deletions.

### A. Non-Negotiable Deletion Safeguards
- **Protected Directory Whitelist**: The leftover removal engine and secure shredder strictly reject root directories (`C:\`, `D:\`), Windows operating system trees (`C:\Windows`, `C:\Windows\System32`, `C:\Windows\SysWOW64`), and standard system mount roots.
- **Path Canonicalization**: All file and directory paths are canonicalized (`Path::canonicalize`) before evaluation to defeat directory traversal attempts or symlink attacks.
- **Multiple Evidence Signals**: File leftovers are never associated with an application based solely on a loose filename match. Identification requires corroboration from installation location records, vendor subdirectories, or registry keys.

### B. Pre-Execution Safety Nets
- **Automatic System Restore Point Creation**: Before invoking an uninstaller, Syntax Uninstaller triggers Windows System Restore (`Checkpoint-Computer`) to ensure a rollback snapshot exists.
- **Registry Hive Backup**: Any registry key queued for leftover removal is first exported to a `.REG` file in the user's local application data directory.
- **Process Verification**: Active processes associated with the target application are detected and presented to the user prior to uninstallation.

### C. IPC Allowlisting & Defense-in-Depth
- No arbitrary shell commands are accepted from the frontend.
- All backend operations execute through strictly typed, allowlisted Tauri commands.
- Process termination actions are verified against protected Windows system processes (e.g., `explorer.exe`, `csrss.exe`, `lsass.exe` are immune to termination).

### D. Modern Storage & SSD Transparency
- For the Evidence Remover and Secure Delete tools, Syntax Uninstaller explicitly warns users about SSD wear-leveling algorithms and TRIM commands. Overwriting logical blocks on modern solid-state drives cannot guarantee physical NAND cell eradication in the same manner as legacy magnetic platters.
