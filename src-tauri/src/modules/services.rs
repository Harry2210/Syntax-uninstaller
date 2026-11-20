use serde::{Deserialize, Serialize};
use std::ffi::OsString;
use std::os::windows::ffi::{OsStrExt, OsStringExt};
use std::ptr;
use std::time::Duration;
use windows_sys::Win32::Foundation::{GetLastError, ERROR_MORE_DATA};
use windows_sys::Win32::System::Services::{
    CloseServiceHandle, EnumServicesStatusExW, OpenSCManagerW, OpenServiceW, QueryServiceConfigW,
    ENUM_SERVICE_STATUS_PROCESSW, QUERY_SERVICE_CONFIGW, SC_ENUM_PROCESS_INFO,
    SC_MANAGER_ENUMERATE_SERVICE, SERVICE_QUERY_CONFIG, SERVICE_STATE_ALL, SERVICE_WIN32,
};

use crate::modules::cache::{self, invalidate};
use crate::modules::winproc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WinService {
    #[serde(
        default,
        deserialize_with = "crate::modules::serde_util::string_or_default"
    )]
    pub name: String,
    #[serde(
        default,
        deserialize_with = "crate::modules::serde_util::string_or_default"
    )]
    pub display_name: String,
    #[serde(
        default,
        deserialize_with = "crate::modules::serde_util::string_or_default"
    )]
    pub status: String,
    #[serde(
        default,
        deserialize_with = "crate::modules::serde_util::string_or_default"
    )]
    pub start_type: String,
}

const CACHE_TTL: Duration = Duration::from_secs(15);

pub fn get_windows_services() -> Vec<WinService> {
    // Cached for a few seconds: the dashboard, the services page and a manual
    // refresh otherwise each walk the service database again.
    cache::cached("services:list", CACHE_TTL, || {
        // The native SCM path takes a few milliseconds. It used to spawn a
        // PowerShell process that took ~280 ms, and that cost was paid on
        // every refresh. PowerShell remains as a fallback for unusual systems
        // where the service database cannot be opened directly.
        match native_services() {
            Ok(services) if !services.is_empty() => services,
            _ => powershell_services(),
        }
    })
}

/// Enumerates services through the Service Control Manager API.
///
/// This is deliberately read-only (`SC_MANAGER_ENUMERATE_SERVICE`), so it can
/// run for standard users and cannot change a service by accident.
fn native_services() -> Result<Vec<WinService>, String> {
    unsafe {
        let scm = OpenSCManagerW(ptr::null(), ptr::null(), SC_MANAGER_ENUMERATE_SERVICE);
        if scm.is_null() {
            return Err("Could not open the Service Control Manager".to_string());
        }
        let _scm_guard = ServiceHandle(scm);

        let mut capacity: u32 = 64 * 1024;
        let mut buffer: Vec<u8> = Vec::new();
        let mut returned: u32 = 0;
        let mut bytes_needed: u32 = 0;

        for _ in 0..4 {
            buffer.resize(capacity as usize, 0);
            let mut resume_handle: u32 = 0;
            let ok = EnumServicesStatusExW(
                scm,
                SC_ENUM_PROCESS_INFO,
                SERVICE_WIN32,
                SERVICE_STATE_ALL,
                buffer.as_mut_ptr(),
                capacity,
                &mut bytes_needed,
                &mut returned,
                &mut resume_handle,
                ptr::null(),
            );

            if ok != 0 {
                break;
            }
            if GetLastError() != ERROR_MORE_DATA {
                return Err("Service enumeration failed".to_string());
            }
            // `bytes_needed` is authoritative; some drivers over-report, so
            // leave headroom and cap the allocation to avoid pathological RAM.
            capacity = bytes_needed
                .max(capacity.saturating_mul(2))
                .min(64 * 1024 * 1024);
        }

        if returned == 0 {
            return Err("Service enumeration returned no entries".to_string());
        }

        let entries = buffer.as_ptr() as *const ENUM_SERVICE_STATUS_PROCESSW;
        let mut services = Vec::with_capacity(returned as usize);

        for index in 0..returned as usize {
            // The buffer is byte-aligned, not struct-aligned: read unaligned.
            let entry = ptr::read_unaligned(entries.add(index));
            let name = wide_ptr_to_string(entry.lpServiceName);
            if name.is_empty() {
                continue;
            }
            let display_name = {
                let candidate = wide_ptr_to_string(entry.lpDisplayName);
                if candidate.is_empty() {
                    name.clone()
                } else {
                    candidate
                }
            };
            let status = state_name(entry.ServiceStatusProcess.dwCurrentState);
            let start_type = query_start_type(scm, &name);

            services.push(WinService {
                name,
                display_name,
                status,
                start_type,
            });
        }

        services.sort_by_key(|service| service.display_name.to_lowercase());
        Ok(services)
    }
}

/// Opens a service only to read its configuration and closes it immediately.
unsafe fn query_start_type(
    scm: windows_sys::Win32::System::Services::SC_HANDLE,
    name: &str,
) -> String {
    let wide: Vec<u16> = OsString::from(name).encode_wide().chain(Some(0)).collect();
    let handle = OpenServiceW(scm, wide.as_ptr(), SERVICE_QUERY_CONFIG);
    if handle.is_null() {
        return "Unknown".to_string();
    }
    let _service_guard = ServiceHandle(handle);

    // `u64` storage keeps the buffer 8-byte aligned for QUERY_SERVICE_CONFIGW.
    let mut buffer = vec![0u64; 1024];
    let mut needed: u32 = 0;
    let size = (buffer.len() * std::mem::size_of::<u64>()) as u32;
    let ok = QueryServiceConfigW(
        handle,
        buffer.as_mut_ptr() as *mut QUERY_SERVICE_CONFIGW,
        size,
        &mut needed,
    );

    if ok == 0 {
        // Configuration changed between enumeration and query; rare.
        if needed as usize > size as usize && needed < 1024 * 1024 {
            buffer.resize((needed as usize).div_ceil(8), 0);
            let size = (buffer.len() * std::mem::size_of::<u64>()) as u32;
            let retried = QueryServiceConfigW(
                handle,
                buffer.as_mut_ptr() as *mut QUERY_SERVICE_CONFIGW,
                size,
                &mut needed,
            );
            if retried == 0 {
                return "Unknown".to_string();
            }
        } else {
            return "Unknown".to_string();
        }
    }

    let config = ptr::read_unaligned(buffer.as_ptr() as *const QUERY_SERVICE_CONFIGW);
    start_type_name(config.dwStartType).to_string()
}

fn start_type_name(value: u32) -> &'static str {
    match value {
        0 => "Boot",
        1 => "System",
        2 => "Automatic",
        3 => "Manual",
        4 => "Disabled",
        _ => "Unknown",
    }
}

fn state_name(value: u32) -> String {
    match value {
        1 => "Stopped",
        2 => "Start Pending",
        3 => "Stop Pending",
        4 => "Running",
        5 => "Continue Pending",
        6 => "Pause Pending",
        7 => "Paused",
        _ => "Unknown",
    }
    .to_string()
}

fn wide_ptr_to_string(value: *const u16) -> String {
    if value.is_null() {
        return String::new();
    }
    unsafe {
        let mut length = 0usize;
        while *value.add(length) != 0 {
            length += 1;
            if length > 32_768 {
                break;
            }
        }
        OsString::from_wide(std::slice::from_raw_parts(value, length))
            .to_string_lossy()
            .to_string()
    }
}

/// Closes an SCM or service handle on every return path.
struct ServiceHandle(windows_sys::Win32::System::Services::SC_HANDLE);

impl Drop for ServiceHandle {
    fn drop(&mut self) {
        if !self.0.is_null() {
            unsafe {
                CloseServiceHandle(self.0);
            }
        }
    }
}

/// Fallback for systems where the SCM API is unavailable.
fn powershell_services() -> Vec<WinService> {
    let script = r#"
        Get-Service |
        Select-Object @{Name='name';Expression={$_.Name}},
                      @{Name='display_name';Expression={$_.DisplayName}},
                      @{Name='status';Expression={$_.Status.ToString()}},
                      @{Name='start_type';Expression={$_.StartType.ToString()}} |
        ConvertTo-Json -Compress
    "#;

    let stdout = match winproc::powershell(script, winproc::DEFAULT_TIMEOUT) {
        Ok(out) => out,
        Err(_) => return Vec::new(),
    };

    if stdout.trim().is_empty() {
        return Vec::new();
    }

    match serde_json::from_str::<Vec<WinService>>(&stdout) {
        Ok(services) => services,
        // A single service is serialised as an object, not an array.
        Err(_) => serde_json::from_str::<WinService>(&stdout)
            .map(|single| vec![single])
            .unwrap_or_default(),
    }
}

pub fn manage_service(service_name: &str, action: &str) -> Result<(), String> {
    let verb = match action {
        "start" => "Start-Service",
        "stop" => "Stop-Service -Force",
        "restart" => "Restart-Service -Force",
        _ => return Err(format!("Invalid service action: {}", action)),
    };

    // ps_string escapes quotes, so a crafted service name cannot inject code.
    let script = format!("{} -Name {}", verb, winproc::ps_string(service_name));

    winproc::powershell(&script, Duration::from_secs(45))?;
    invalidate("services:");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_service_start_types() {
        assert_eq!(start_type_name(2), "Automatic");
        assert_eq!(start_type_name(3), "Manual");
        assert_eq!(start_type_name(4), "Disabled");
        assert_eq!(start_type_name(99), "Unknown");
    }

    #[test]
    fn maps_service_states() {
        assert_eq!(state_name(4), "Running");
        assert_eq!(state_name(1), "Stopped");
        assert_eq!(state_name(0), "Unknown");
    }

    #[test]
    fn reads_wide_strings_and_stops_at_nul() {
        let text: Vec<u16> = "Spooler\0ignored".encode_utf16().collect();
        assert_eq!(wide_ptr_to_string(text.as_ptr()), "Spooler");
        assert_eq!(wide_ptr_to_string(std::ptr::null()), "");
    }
}
