use serde::{Deserialize, Serialize};
use std::ffi::OsStr;
use std::fs;
use std::os::windows::ffi::OsStrExt;
use std::path::Path;
use sysinfo::{ProcessesToUpdate, System};
use winreg::enums::*;
use winreg::RegKey;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LockingProcess {
    pub pid: u32,
    pub name: String,
    pub exe_path: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LockedFileStatus {
    pub path: String,
    pub exists: bool,
    pub is_locked: bool,
    pub is_scheduled_reboot: bool,
    pub locking_processes: Vec<LockingProcess>,
}

#[link(name = "kernel32")]
extern "system" {
    fn MoveFileExW(lpExistingFileName: *const u16, lpNewFileName: *const u16, dwFlags: u32) -> i32;
}

const MOVEFILE_DELAY_UNTIL_REBOOT: u32 = 0x00000004;

pub fn inspect_path(path_str: &str) -> LockedFileStatus {
    let p = Path::new(path_str);
    let exists = p.exists();
    let mut is_locked = false;
    let mut locking_processes = Vec::new();

    if exists {
        // Test lock by attempting to open file in write mode
        if p.is_file() {
            if fs::OpenOptions::new().write(true).open(p).is_err() {
                is_locked = true;
            }
        } else if p.is_dir() {
            // Test dir lock by attempting to rename to self or read dir
            if p.read_dir().is_err() {
                is_locked = true;
            }
        }

        // Search running processes holding this binary or folder
        if is_locked || exists {
            let mut s = System::new_all();
            s.refresh_processes(ProcessesToUpdate::All, true);

            let norm_target = path_str.to_lowercase().replace('/', "\\");

            for (pid, proc_) in s.processes() {
                let exe_str = proc_
                    .exe()
                    .map(|e| e.to_string_lossy().to_lowercase().replace('/', "\\"))
                    .unwrap_or_default();

                if !exe_str.is_empty()
                    && (exe_str == norm_target || exe_str.starts_with(&norm_target))
                {
                    locking_processes.push(LockingProcess {
                        pid: pid.as_u32(),
                        name: proc_.name().to_string_lossy().to_string(),
                        exe_path: proc_
                            .exe()
                            .map(|e| e.to_string_lossy().to_string())
                            .unwrap_or_default(),
                    });
                    is_locked = true;
                }
            }
        }
    }

    let pending_deletions = get_pending_reboot_deletions();
    let is_scheduled = pending_deletions
        .iter()
        .any(|d| d.eq_ignore_ascii_case(path_str));

    LockedFileStatus {
        path: path_str.to_string(),
        exists,
        is_locked,
        is_scheduled_reboot: is_scheduled,
        locking_processes,
    }
}

pub fn unlock_and_delete(path_str: &str) -> Result<String, String> {
    let p = Path::new(path_str);
    if !p.exists() {
        return Ok("Target already deleted or does not exist".into());
    }

    // First terminate any known locking processes
    let status = inspect_path(path_str);
    for proc_info in &status.locking_processes {
        let mut s = System::new_all();
        s.refresh_processes(ProcessesToUpdate::All, true);
        if let Some(p) = s.process(sysinfo::Pid::from_u32(proc_info.pid)) {
            let _ = p.kill();
        }
    }

    // Brief pause to let file handles release
    std::thread::sleep(std::time::Duration::from_millis(150));

    // Attempt direct deletion
    if p.is_file() {
        fs::remove_file(p).map_err(|e| format!("Cannot delete file '{}': {}", path_str, e))?;
    } else if p.is_dir() {
        fs::remove_dir_all(p).map_err(|e| format!("Cannot delete folder '{}': {}", path_str, e))?;
    }

    Ok(format!(
        "Successfully unlocked and permanently eradicated '{}'",
        path_str
    ))
}

pub fn schedule_reboot_deletion(path_str: &str) -> Result<String, String> {
    let p = Path::new(path_str);
    if !p.exists() {
        return Err(format!("Path '{}' does not exist", path_str));
    }

    let wide: Vec<u16> = OsStr::new(path_str).encode_wide().chain(Some(0)).collect();

    let success = unsafe {
        MoveFileExW(
            wide.as_ptr(),
            std::ptr::null(), // NULL means delete upon reboot
            MOVEFILE_DELAY_UNTIL_REBOOT,
        )
    };

    if success != 0 {
        Ok(format!(
            "Successfully scheduled '{}' for automatic kernel-level deletion on next system boot.",
            path_str
        ))
    } else {
        let err = std::io::Error::last_os_error();
        Err(format!("MoveFileExW failed: {}", err))
    }
}

pub fn get_pending_reboot_deletions() -> Vec<String> {
    let mut items = Vec::new();
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    if let Ok(key) = hklm.open_subkey_with_flags(
        r"SYSTEM\CurrentControlSet\Control\Session Manager",
        KEY_READ,
    ) {
        if let Ok(strings) = key.get_value::<Vec<String>, _>("PendingFileRenameOperations") {
            for s in strings {
                if !s.is_empty() {
                    let clean = s.replace(r"\??\", "");
                    items.push(clean);
                }
            }
        }
    }
    items
}

pub fn clear_pending_reboot_deletions() -> Result<(), String> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let key = hklm
        .open_subkey_with_flags(
            r"SYSTEM\CurrentControlSet\Control\Session Manager",
            KEY_WRITE,
        )
        .map_err(|e| format!("Cannot open Session Manager key: {}", e))?;

    key.delete_value("PendingFileRenameOperations")
        .map_err(|e| format!("Failed to clear PendingFileRenameOperations: {}", e))
}
