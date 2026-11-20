use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::modules::cache::{self, invalidate};
use crate::modules::icon_extractor;
use crate::modules::winproc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowsApp {
    #[serde(
        default,
        deserialize_with = "crate::modules::serde_util::string_or_default"
    )]
    pub name: String,
    #[serde(
        default,
        deserialize_with = "crate::modules::serde_util::string_or_default"
    )]
    pub package_full_name: String,
    #[serde(
        default,
        deserialize_with = "crate::modules::serde_util::string_or_default"
    )]
    pub publisher: String,
    #[serde(
        default,
        deserialize_with = "crate::modules::serde_util::string_or_default"
    )]
    pub version: String,
    #[serde(
        default,
        deserialize_with = "crate::modules::serde_util::string_or_default"
    )]
    pub install_location: String,
    #[serde(
        default,
        deserialize_with = "crate::modules::serde_util::bool_or_default"
    )]
    pub non_removable: bool,
    #[serde(
        default,
        deserialize_with = "crate::modules::serde_util::string_or_default"
    )]
    pub display_icon: String,
}

pub fn get_installed_windows_apps() -> Vec<WindowsApp> {
    // AppX enumeration starts a PowerShell process and extracts package icons.
    // It is the slowest inventory read, and the dashboard/page/refresh path can
    // ask for it several times in a row, so keep a short cache.
    cache::cached("windows_apps:list", Duration::from_secs(30), || {
        scan_windows_apps()
    })
}

fn scan_windows_apps() -> Vec<WindowsApp> {
    // Keys are explicitly lower_snake_case to match `WindowsApp`. The previous
    // PascalCase JSON (Name, PackageFullName, …) failed to deserialize, which is
    // why the Windows Apps page always looked empty.
    let script = r#"
        Get-AppxPackage |
        Where-Object { $_.IsFramework -eq $false -and $_.NonRemovable -ne $true } |
        Select-Object @{Name='name';Expression={$_.Name}},
                      @{Name='package_full_name';Expression={$_.PackageFullName}},
                      @{Name='publisher';Expression={$_.Publisher}},
                      @{Name='version';Expression={$_.Version.ToString()}},
                      @{Name='install_location';Expression={if ($_.InstallLocation) { $_.InstallLocation } else { '' }}},
                      @{Name='non_removable';Expression={[bool]$_.NonRemovable}} |
        ConvertTo-Json -Compress
    "#;

    let output = match winproc::powershell(script, Duration::from_secs(60)) {
        Ok(out) => out,
        Err(_) => return Vec::new(),
    };

    let json_str = output;
    if json_str.trim().is_empty() {
        return Vec::new();
    }

    let mut apps: Vec<WindowsApp> =
        if let Ok(parsed) = serde_json::from_str::<Vec<WindowsApp>>(&json_str) {
            parsed
        } else if let Ok(single) = serde_json::from_str::<WindowsApp>(&json_str) {
            vec![single]
        } else {
            Vec::new()
        };

    // Enrich each app with authentic high-res PNG icon extracted directly from its package Assets
    for app in &mut apps {
        if let Some(data_url) = icon_extractor::extract_appx_icon(&app.install_location) {
            app.display_icon = data_url;
        }
    }

    // Sort alphabetically by name
    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    apps
}

pub fn remove_windows_app(package_full_name: &str) -> Result<(), String> {
    let script = format!(
        "Remove-AppxPackage -Package {}",
        winproc::ps_string(package_full_name)
    );

    winproc::powershell(&script, Duration::from_secs(120))
        .map(|_| ())
        .map_err(|e| format!("Failed to uninstall Windows App: {}", e))?;

    invalidate("windows_apps:");
    Ok(())
}
