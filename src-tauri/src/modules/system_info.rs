use serde::{Deserialize, Serialize};
use std::time::Duration;
use sysinfo::{Disks, System};

use crate::modules::cache;

const SPECS_TTL: Duration = Duration::from_secs(5);

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DiskInfo {
    pub name: String,
    pub mount_point: String,
    pub total_space_bytes: u64,
    pub available_space_bytes: u64,
    pub file_system: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SystemSpecs {
    pub os_name: String,
    pub os_version: String,
    pub computer_name: String,
    pub username: String,
    pub architecture: String,
    pub is_admin: bool,
    pub cpu_name: String,
    pub cpu_cores: usize,
    pub total_ram_mb: u64,
    pub used_ram_mb: u64,
    pub available_ram_mb: u64,
    pub disks: Vec<DiskInfo>,
}

pub fn get_system_specs() -> SystemSpecs {
    // The dashboard, the floating RAM widget and the PC Specs page can all ask
    // for this within the same second. A 5 s cache avoids refreshing CPU,
    // memory and every volume for each of them; the data is still fresh enough
    // for a live gauge.
    cache::cached("system:specs", SPECS_TTL, get_system_specs_uncached)
}

fn get_system_specs_uncached() -> SystemSpecs {
    let mut sys = System::new_all();
    sys.refresh_all();

    let disks = Disks::new_with_refreshed_list();
    let disk_list: Vec<DiskInfo> = disks
        .list()
        .iter()
        .map(|d| DiskInfo {
            name: d.name().to_string_lossy().to_string(),
            mount_point: d.mount_point().to_string_lossy().to_string(),
            total_space_bytes: d.total_space(),
            available_space_bytes: d.available_space(),
            file_system: d.file_system().to_string_lossy().to_string(),
        })
        .collect();

    let cpu_name = sys
        .cpus()
        .first()
        .map(|c| c.brand().to_string())
        .unwrap_or_else(|| "Unknown CPU".to_string());
    let cpu_cores = sys.cpus().len();

    let is_admin = check_admin_privileges();

    SystemSpecs {
        os_name: System::name().unwrap_or_else(|| "Windows".to_string()),
        os_version: System::os_version().unwrap_or_else(|| "11".to_string()),
        computer_name: System::host_name().unwrap_or_else(|| "DESKTOP-PC".to_string()),
        username: std::env::var("USERNAME").unwrap_or_else(|_| "User".to_string()),
        architecture: std::env::consts::ARCH.to_string(),
        is_admin,
        cpu_name,
        cpu_cores,
        total_ram_mb: sys.total_memory() / (1024 * 1024),
        used_ram_mb: sys.used_memory() / (1024 * 1024),
        available_ram_mb: sys.available_memory() / (1024 * 1024),
        disks: disk_list,
    }
}

#[link(name = "shell32")]
extern "system" {
    /// Returns non-zero when the current process token is elevated.
    fn IsUserAnAdmin() -> i32;
}

fn check_admin_privileges() -> bool {
    // PERFORMANCE: this used to spawn `net session` (a whole new process,
    // ~150 ms) on every call. The Win32 check is a single in-process call.
    unsafe { IsUserAnAdmin() != 0 }
}

/// Whether the current process token is elevated. Shared by the updater so
/// the UI can explain when Windows will ask for administrator approval.
pub fn is_elevated() -> bool {
    check_admin_privileges()
}
