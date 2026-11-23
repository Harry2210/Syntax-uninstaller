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
    cache::cached("windows_apps:list", Duration::from_secs(30), || {
        scan_windows_apps()
    })
}

fn scan_windows_apps() -> Vec<WindowsApp> {
    let script = r#"
        $sa = @{}
        try {
            Get-StartApps | Where-Object { $_.AppID -like '*!*' } | ForEach-Object {
                $p = $_.AppID.Split('!')[0]
                if (-not $sa.ContainsKey($p)) {
                    $sa[$p] = $_.Name
                }
            }
        } catch {}

        $known = @{
            'Microsoft.WindowsCalculator' = 'Calculator'
            'Microsoft.ScreenSketch' = 'Snipping Tool'
            'Microsoft.WindowsCamera' = 'Camera'
            'Microsoft.WindowsSoundRecorder' = 'Sound Recorder'
            'Microsoft.WindowsTerminal' = 'Terminal'
            'Microsoft.Paint' = 'Paint'
            'Microsoft.MSPaint' = 'Paint 3D'
            'Microsoft.Windows.Photos' = 'Photos'
            'Microsoft.ZuneVideo' = 'Films & TV'
            'Microsoft.ZuneMusic' = 'Media Player'
            'Microsoft.YourPhone' = 'Phone Link'
            'Microsoft.WindowsStore' = 'Microsoft Store'
            'Microsoft.XboxGamingOverlay' = 'Game Bar'
            'Microsoft.XboxApp' = 'Xbox'
            'Microsoft.XboxSpeechToTextOverlay' = 'Xbox Game Speech'
            'Microsoft.WindowsAlarms' = 'Clock'
            'Microsoft.WindowsMaps' = 'Maps'
            'Microsoft.BingWeather' = 'Weather'
            'Microsoft.BingNews' = 'News'
            'Microsoft.MicrosoftStickyNotes' = 'Sticky Notes'
            'Microsoft.GetHelp' = 'Get Help'
            'Microsoft.Getstarted' = 'Tips'
            'Microsoft.MicrosoftOfficeHub' = 'Copilot / Microsoft 365'
            'Microsoft.SecHealthUI' = 'Windows Security'
            'Microsoft.WindowsFeedbackHub' = 'Feedback Hub'
            'Microsoft.Todos' = 'Microsoft To Do'
            'Microsoft.PowerAutomateDesktop' = 'Power Automate'
            'Microsoft.WindowsNotepad' = 'Notepad'
            'AnthropicPBC.Claude' = 'Claude'
            'SpotifyAB.SpotifyMusic' = 'Spotify'
            'WhatsApp' = 'WhatsApp'
            'TelegramMessengerLLP.TelegramDesktop' = 'Telegram'
        }

        Get-AppxPackage |
        Where-Object { -not $_.IsFramework -and -not $_.NonRemovable } |
        ForEach-Object {
            $raw = $_.Name
            $pfn = $_.PackageFamilyName
            $friendly = $raw

            if ($sa.ContainsKey($pfn) -and $sa[$pfn]) {
                $friendly = $sa[$pfn]
            } elseif ($known.ContainsKey($raw)) {
                $friendly = $known[$raw]
            } else {
                $clean = $raw -replace '^Microsoft\.', '' -replace '^MicrosoftWindows\.', '' -replace '^AnthropicPBC\.', ''
                $clean = ($clean -creplace '([a-z])([A-Z])', '$1 $2').Trim()
                if ($clean) { $friendly = $clean }
            }

            $pub = $_.Publisher
            if ($pub -match 'CN=([^,]+)') {
                $pub = $Matches[1]
            }

            [PSCustomObject]@{
                name = $friendly
                package_full_name = $_.PackageFullName
                publisher = if ($pub) { $pub } else { 'Microsoft Corporation' }
                version = $_.Version.ToString()
                install_location = if ($_.InstallLocation) { $_.InstallLocation } else { '' }
                non_removable = [bool]$_.NonRemovable
                display_icon = ''
            }
        } | ConvertTo-Json -Compress
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

    // Sort alphabetically by friendly name
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
