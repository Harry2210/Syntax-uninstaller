use serde::{Deserialize, Serialize};
use winreg::enums::*;
use winreg::RegKey;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebloatItem {
    pub id: String,
    pub name: String,
    pub category: String, // "Telemetry & Privacy", "Windows AI & Bloat", "Windows Services", "Taskbar & Search", "Edge & Background"
    pub description: String,
    pub is_shielded: bool, // true if debloat/privacy protection is applied or service is disconnected
    pub recommended: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub service_name: Option<String>,
}

struct DebloatRule {
    id: &'static str,
    name: &'static str,
    category: &'static str,
    description: &'static str,
    recommended: bool,
    hive: winreg::HKEY,
    subkey: &'static str,
    value_name: &'static str,
    shield_val: u32,
    default_val: u32,
    service_name: Option<&'static str>,
}

const RULES: &[DebloatRule] = &[
    // --- TELEMETRY & PRIVACY ---
    DebloatRule {
        id: "telemetry",
        name: "Diagnostic Telemetry Data Collection",
        category: "Telemetry & Privacy",
        description: "Prevents Windows from sending telemetry, diagnostic reports, and system usage traces to remote servers.",
        recommended: true,
        hive: HKEY_LOCAL_MACHINE,
        subkey: r"SOFTWARE\Policies\Microsoft\Windows\DataCollection",
        value_name: "AllowTelemetry",
        shield_val: 0,
        default_val: 3,
        service_name: Some("DiagTrack"),
    },
    DebloatRule {
        id: "advertising_id",
        name: "Personalized Advertising ID",
        category: "Telemetry & Privacy",
        description: "Disables the unique user advertising identifier used by Windows Store apps for commercial profiling.",
        recommended: true,
        hive: HKEY_CURRENT_USER,
        subkey: r"Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo",
        value_name: "Enabled",
        shield_val: 0,
        default_val: 1,
        service_name: None,
    },
    DebloatRule {
        id: "activity_history",
        name: "Windows Activity History & Timeline",
        category: "Telemetry & Privacy",
        description: "Stops Windows from recording tasks, open documents, and app launches into the local activity feed.",
        recommended: true,
        hive: HKEY_LOCAL_MACHINE,
        subkey: r"SOFTWARE\Policies\Microsoft\Windows\System",
        value_name: "EnableActivityFeed",
        shield_val: 0,
        default_val: 1,
        service_name: None,
    },
    DebloatRule {
        id: "ceip_telemetry",
        name: "Customer Experience Improvement Program (CEIP)",
        category: "Telemetry & Privacy",
        description: "Disables Windows Customer Experience data collection tasks and telemetry uploads.",
        recommended: true,
        hive: HKEY_LOCAL_MACHINE,
        subkey: r"SOFTWARE\Policies\Microsoft\SQMClient\Windows",
        value_name: "CEIPEnable",
        shield_val: 0,
        default_val: 1,
        service_name: None,
    },
    DebloatRule {
        id: "typing_telemetry",
        name: "Typing & Handwriting Recognition Telemetry",
        category: "Telemetry & Privacy",
        description: "Prevents Windows from transmitting keystrokes and handwriting gestures to cloud dictionary servers.",
        recommended: true,
        hive: HKEY_CURRENT_USER,
        subkey: r"Software\Microsoft\InputPersonalization",
        value_name: "RestrictImplicitInkCollection",
        shield_val: 1,
        default_val: 0,
        service_name: None,
    },
    DebloatRule {
        id: "tailored_experiences",
        name: "Tailored Experiences with Diagnostic Data",
        category: "Telemetry & Privacy",
        description: "Disables personalized recommendations, ads, and system tips based on diagnostic telemetry.",
        recommended: true,
        hive: HKEY_CURRENT_USER,
        subkey: r"Software\Policies\Microsoft\Windows\CloudContent",
        value_name: "DisableTailoredExperiencesWithDiagnosticData",
        shield_val: 1,
        default_val: 0,
        service_name: None,
    },
    DebloatRule {
        id: "feedback_frequency",
        name: "Automated Feedback Requests",
        category: "Telemetry & Privacy",
        description: "Silences recurring Windows feedback prompts, surveys, and satisfaction questionnaires.",
        recommended: true,
        hive: HKEY_CURRENT_USER,
        subkey: r"Software\Microsoft\Siuf\Rules",
        value_name: "NumberOfSIUFInPeriod",
        shield_val: 0,
        default_val: 1,
        service_name: None,
    },

    // --- WINDOWS SERVICES (DISCONNECT SERVICES) ---
    DebloatRule {
        id: "wersvc",
        name: "Windows Error Reporting Service (WerSvc)",
        category: "Windows Services",
        description: "Disconnects the Error Reporting service to prevent freezing apps during crashes and uploading memory dumps.",
        recommended: true,
        hive: HKEY_LOCAL_MACHINE,
        subkey: r"SYSTEM\CurrentControlSet\Services\WerSvc",
        value_name: "Start",
        shield_val: 4,
        default_val: 3,
        service_name: Some("WerSvc"),
    },
    DebloatRule {
        id: "dosvc",
        name: "Delivery Optimization P2P Updates (DoSvc)",
        category: "Windows Services",
        description: "Disconnects peer-to-peer Windows Update uploads to protect your internet bandwidth and CPU.",
        recommended: true,
        hive: HKEY_LOCAL_MACHINE,
        subkey: r"SYSTEM\CurrentControlSet\Services\DoSvc",
        value_name: "Start",
        shield_val: 4,
        default_val: 2,
        service_name: Some("DoSvc"),
    },
    DebloatRule {
        id: "cdpsvc",
        name: "Connected Devices Platform Service (CDPSvc)",
        category: "Windows Services",
        description: "Disconnects background synchronization of activities, apps, and clipboard across networked devices.",
        recommended: true,
        hive: HKEY_LOCAL_MACHINE,
        subkey: r"SYSTEM\CurrentControlSet\Services\CDPSvc",
        value_name: "Start",
        shield_val: 4,
        default_val: 2,
        service_name: Some("CDPSvc"),
    },
    DebloatRule {
        id: "remote_registry",
        name: "Remote Registry Service (RemoteRegistry)",
        category: "Windows Services",
        description: "Disconnects the service that permits remote networked computers to inspect or edit your system registry.",
        recommended: true,
        hive: HKEY_LOCAL_MACHINE,
        subkey: r"SYSTEM\CurrentControlSet\Services\RemoteRegistry",
        value_name: "Start",
        shield_val: 4,
        default_val: 3,
        service_name: Some("RemoteRegistry"),
    },
    DebloatRule {
        id: "xbox_services",
        name: "Xbox Live & Gaming Background Services",
        category: "Windows Services",
        description: "Disconnects Xbox Live auth, game saving, and networking services if you do not play Xbox Store games.",
        recommended: false,
        hive: HKEY_LOCAL_MACHINE,
        subkey: r"SYSTEM\CurrentControlSet\Services\XblAuthManager",
        value_name: "Start",
        shield_val: 4,
        default_val: 3,
        service_name: Some("XblAuthManager"),
    },
    DebloatRule {
        id: "maps_broker",
        name: "Downloaded Maps Manager Service (MapsBroker)",
        category: "Windows Services",
        description: "Disconnects background Windows Maps service from constantly downloading offline map tile updates.",
        recommended: true,
        hive: HKEY_LOCAL_MACHINE,
        subkey: r"SYSTEM\CurrentControlSet\Services\MapsBroker",
        value_name: "Start",
        shield_val: 4,
        default_val: 2,
        service_name: Some("MapsBroker"),
    },
    DebloatRule {
        id: "diag_troubleshooting",
        name: "Diagnostic Policy & Troubleshooting Service (DPS)",
        category: "Windows Services",
        description: "Disconnects background diagnostic policy daemons and automated remote troubleshooting queries.",
        recommended: true,
        hive: HKEY_LOCAL_MACHINE,
        subkey: r"SYSTEM\CurrentControlSet\Services\DPS",
        value_name: "Start",
        shield_val: 4,
        default_val: 2,
        service_name: Some("DPS"),
    },
    DebloatRule {
        id: "location_sensor",
        name: "Geolocation & Sensor Service (lfsvc)",
        category: "Windows Services",
        description: "Disconnects the Windows Geolocation service and blocks apps from polling physical coordinates.",
        recommended: false,
        hive: HKEY_LOCAL_MACHINE,
        subkey: r"SYSTEM\CurrentControlSet\Services\lfsvc",
        value_name: "Start",
        shield_val: 4,
        default_val: 3,
        service_name: Some("lfsvc"),
    },
    DebloatRule {
        id: "biometrics_service",
        name: "Windows Biometric Service (WbioSrvc)",
        category: "Windows Services",
        description: "Disconnects fingerprint reader and facial recognition background polling if you sign in with password/PIN.",
        recommended: false,
        hive: HKEY_LOCAL_MACHINE,
        subkey: r"SYSTEM\CurrentControlSet\Services\WbioSrvc",
        value_name: "Start",
        shield_val: 4,
        default_val: 2,
        service_name: Some("WbioSrvc"),
    },

    // --- WINDOWS AI & BLOAT ---
    DebloatRule {
        id: "windows_copilot",
        name: "Windows Copilot AI Assistant",
        category: "Windows AI & Bloat",
        description: "Disables the background Copilot generative AI runtime, taskbar integration, and sidebar overlay.",
        recommended: true,
        hive: HKEY_CURRENT_USER,
        subkey: r"Software\Policies\Microsoft\Windows\WindowsCopilot",
        value_name: "TurnOffWindowsCopilot",
        shield_val: 1,
        default_val: 0,
        service_name: None,
    },
    DebloatRule {
        id: "windows_recall",
        name: "Windows Recall AI Snapshots",
        category: "Windows AI & Bloat",
        description: "Prevents Windows from capturing periodic desktop snapshots for AI indexing and behavioral profiling.",
        recommended: true,
        hive: HKEY_CURRENT_USER,
        subkey: r"Software\Policies\Microsoft\Windows\WindowsAI",
        value_name: "DisableAIDataAnalysis",
        shield_val: 1,
        default_val: 0,
        service_name: None,
    },
    DebloatRule {
        id: "cortana",
        name: "Cortana Voice Assistant",
        category: "Windows AI & Bloat",
        description: "Completely shuts down Cortana voice recognition background processes and microphone listeners.",
        recommended: true,
        hive: HKEY_LOCAL_MACHINE,
        subkey: r"SOFTWARE\Policies\Microsoft\Windows\Windows Search",
        value_name: "AllowCortana",
        shield_val: 0,
        default_val: 1,
        service_name: None,
    },
    DebloatRule {
        id: "suggested_apps",
        name: "Automatic Sponsored App Installs",
        category: "Windows AI & Bloat",
        description: "Blocks Windows from silently downloading and pinning sponsored Store apps (e.g. Candy Crush, TikTok).",
        recommended: true,
        hive: HKEY_CURRENT_USER,
        subkey: r"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager",
        value_name: "SilentInstalledAppsEnabled",
        shield_val: 0,
        default_val: 1,
        service_name: None,
    },
    DebloatRule {
        id: "windows_tips",
        name: "Windows Tips & Lock Screen Ads",
        category: "Windows AI & Bloat",
        description: "Silences promotional suggestions, lock screen commercial recommendations, and Settings tips.",
        recommended: true,
        hive: HKEY_CURRENT_USER,
        subkey: r"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager",
        value_name: "SubscribedContent-338388Enabled",
        shield_val: 0,
        default_val: 1,
        service_name: None,
    },
    DebloatRule {
        id: "gamedvr",
        name: "GameDVR Background Video Capture",
        category: "Windows AI & Bloat",
        description: "Disables background gaming video capture buffer to eliminate CPU/GPU micro-stutters and boost FPS.",
        recommended: true,
        hive: HKEY_CURRENT_USER,
        subkey: r"System\GameConfigStore",
        value_name: "GameDVR_Enabled",
        shield_val: 0,
        default_val: 1,
        service_name: None,
    },

    // --- TASKBAR & SEARCH ---
    DebloatRule {
        id: "bing_search",
        name: "Bing Web Search in Start Menu",
        category: "Taskbar & Search",
        description: "Removes web search queries and Bing online suggestions from the Start Menu search bar.",
        recommended: true,
        hive: HKEY_CURRENT_USER,
        subkey: r"Software\Microsoft\Windows\CurrentVersion\Search",
        value_name: "BingSearchEnabled",
        shield_val: 0,
        default_val: 1,
        service_name: None,
    },
    DebloatRule {
        id: "cloud_search",
        name: "Windows Search Box Cloud Suggestions",
        category: "Taskbar & Search",
        description: "Restricts Start Menu search strictly to local files, speeding up search results and cutting web queries.",
        recommended: true,
        hive: HKEY_CURRENT_USER,
        subkey: r"Software\Policies\Microsoft\Windows\Explorer",
        value_name: "DisableSearchBoxSuggestions",
        shield_val: 1,
        default_val: 0,
        service_name: None,
    },

    // --- EDGE & BACKGROUND ---
    DebloatRule {
        id: "edge_prelaunch",
        name: "Microsoft Edge Background Pre-launching",
        category: "Edge & Background",
        description: "Stops Microsoft Edge processes from pre-launching silently on Windows startup to consume RAM.",
        recommended: true,
        hive: HKEY_LOCAL_MACHINE,
        subkey: r"SOFTWARE\Policies\Microsoft\MicrosoftEdge\Main",
        value_name: "AllowPrelaunch",
        shield_val: 0,
        default_val: 1,
        service_name: None,
    },
    DebloatRule {
        id: "edge_startup_boost",
        name: "Microsoft Edge Startup Boost & Background Extensions",
        category: "Edge & Background",
        description: "Prevents Edge from keeping resident background processes and extensions active in memory when closed.",
        recommended: true,
        hive: HKEY_LOCAL_MACHINE,
        subkey: r"SOFTWARE\Policies\Microsoft\Edge",
        value_name: "StartupBoostEnabled",
        shield_val: 0,
        default_val: 1,
        service_name: None,
    },
];

/// Writes a DWORD registry value, automatically utilizing elevated UAC escalation if machine scope access requires it
fn write_reg_u32(hive: winreg::HKEY, subkey: &str, value_name: &str, val: u32) -> Result<(), String> {
    let reg = RegKey::predef(hive);
    let is_machine = hive == HKEY_LOCAL_MACHINE;

    // 1. Try direct write first
    if let Ok((key, _)) = reg.create_subkey_with_flags(subkey, KEY_WRITE) {
        if key.set_value(value_name, &val).is_ok() {
            return Ok(());
        }
    }

    // 2. If machine hive and direct write was rejected (non-elevated process), attempt elevated write
    if is_machine {
        let script = format!(
            "if (!(Test-Path 'HKLM:\\{0}')) {{ New-Item -Path 'HKLM:\\{0}' -Force | Out-Null }}; Set-ItemProperty -Path 'HKLM:\\{0}' -Name '{1}' -Value {2} -Type DWord -Force",
            subkey, value_name, val
        );
        let escaped = script.replace('"', "\\\"");
        let cmd = format!(
            "Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile -Command \"{}\"'",
            escaped
        );

        let mut command = std::process::Command::new("powershell");
        command.args(&["-NoProfile", "-WindowStyle", "Hidden", "-Command", &cmd]);
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        if let Ok(status) = command.status() {
            if status.success() {
                // Confirm the write succeeded
                if let Ok(key) = reg.open_subkey_with_flags(subkey, KEY_READ) {
                    if let Ok(check_val) = key.get_value::<u32, _>(value_name) {
                        if check_val == val {
                            return Ok(());
                        }
                    }
                }
            }
        }

        return Err("Administrator privileges required to modify system-wide Windows privacy policies. Please run Syntax Uninstaller as Administrator.".to_string());
    }

    Err(format!("Failed to write registry value '{}\\{}'", subkey, value_name))
}

pub fn get_debloat_items() -> Vec<DebloatItem> {
    let mut items = Vec::new();

    for rule in RULES {
        let is_shielded = check_rule_shielded(rule);
        items.push(DebloatItem {
            id: rule.id.to_string(),
            name: rule.name.to_string(),
            category: rule.category.to_string(),
            description: rule.description.to_string(),
            is_shielded,
            recommended: rule.recommended,
            service_name: rule.service_name.map(|s| s.to_string()),
        });
    }

    items
}

pub fn set_debloat_item(id: &str, enable_shield: bool) -> Result<(), String> {
    let rule = RULES
        .iter()
        .find(|r| r.id == id)
        .ok_or_else(|| format!("Unknown debloat rule '{}'", id))?;

    let target_val = if enable_shield {
        rule.shield_val
    } else {
        rule.default_val
    };

    // Primary rule write
    let _ = write_reg_u32(rule.hive, rule.subkey, rule.value_name, target_val);

    // Companion service and policy configurations
    match id {
        "telemetry" => {
            let _ = write_reg_u32(
                HKEY_LOCAL_MACHINE,
                r"SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\DataCollection",
                "AllowTelemetry",
                target_val,
            );
            if enable_shield {
                let _ = crate::modules::services::manage_service("DiagTrack", "disable");
            } else {
                let _ = crate::modules::services::manage_service("DiagTrack", "automatic");
                let _ = crate::modules::services::manage_service("DiagTrack", "start");
            }
        }
        "wersvc" => {
            let _ = write_reg_u32(
                HKEY_LOCAL_MACHINE,
                r"SOFTWARE\Policies\Microsoft\Windows\Windows Error Reporting",
                "Disabled",
                if enable_shield { 1 } else { 0 },
            );
            if enable_shield {
                let _ = crate::modules::services::manage_service("WerSvc", "disable");
            } else {
                let _ = crate::modules::services::manage_service("WerSvc", "manual");
            }
        }
        "dosvc" => {
            let _ = write_reg_u32(
                HKEY_LOCAL_MACHINE,
                r"SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization",
                "DODownloadMode",
                if enable_shield { 0 } else { 1 },
            );
            if enable_shield {
                let _ = crate::modules::services::manage_service("DoSvc", "disable");
            } else {
                let _ = crate::modules::services::manage_service("DoSvc", "automatic");
            }
        }
        "cdpsvc" => {
            let _ = write_reg_u32(
                HKEY_LOCAL_MACHINE,
                r"SOFTWARE\Policies\Microsoft\Windows\System",
                "EnableCdp",
                if enable_shield { 0 } else { 1 },
            );
            if enable_shield {
                let _ = crate::modules::services::manage_service("CDPSvc", "disable");
            } else {
                let _ = crate::modules::services::manage_service("CDPSvc", "automatic");
            }
        }
        "remote_registry" => {
            if enable_shield {
                let _ = crate::modules::services::manage_service("RemoteRegistry", "disable");
            } else {
                let _ = crate::modules::services::manage_service("RemoteRegistry", "manual");
            }
        }
        "xbox_services" => {
            let _ = write_reg_u32(
                HKEY_LOCAL_MACHINE,
                r"SOFTWARE\Policies\Microsoft\Windows\GameDVR",
                "AllowGameDVR",
                if enable_shield { 0 } else { 1 },
            );
            if enable_shield {
                let _ = crate::modules::services::manage_service("XblAuthManager", "disable");
                let _ = crate::modules::services::manage_service("XblGameSave", "disable");
                let _ = crate::modules::services::manage_service("XboxNetApiSvc", "disable");
            } else {
                let _ = crate::modules::services::manage_service("XblAuthManager", "manual");
                let _ = crate::modules::services::manage_service("XblGameSave", "manual");
                let _ = crate::modules::services::manage_service("XboxNetApiSvc", "manual");
            }
        }
        "maps_broker" => {
            if enable_shield {
                let _ = crate::modules::services::manage_service("MapsBroker", "disable");
            } else {
                let _ = crate::modules::services::manage_service("MapsBroker", "automatic");
            }
        }
        "diag_troubleshooting" => {
            let _ = write_reg_u32(
                HKEY_LOCAL_MACHINE,
                r"SOFTWARE\Policies\Microsoft\Windows\ScriptedDiagnosticsProvider\Policy",
                "DisableQueryRemoteServer",
                if enable_shield { 1 } else { 0 },
            );
            if enable_shield {
                let _ = crate::modules::services::manage_service("DPS", "disable");
            } else {
                let _ = crate::modules::services::manage_service("DPS", "automatic");
            }
        }
        "location_sensor" => {
            let _ = write_reg_u32(
                HKEY_LOCAL_MACHINE,
                r"SOFTWARE\Policies\Microsoft\Windows\LocationAndSensors",
                "DisableLocation",
                if enable_shield { 1 } else { 0 },
            );
            if enable_shield {
                let _ = crate::modules::services::manage_service("lfsvc", "disable");
            } else {
                let _ = crate::modules::services::manage_service("lfsvc", "manual");
            }
        }
        "biometrics_service" => {
            if enable_shield {
                let _ = crate::modules::services::manage_service("WbioSrvc", "disable");
            } else {
                let _ = crate::modules::services::manage_service("WbioSrvc", "automatic");
            }
        }
        "windows_copilot" => {
            let _ = write_reg_u32(
                HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced",
                "ShowCopilotButton",
                if enable_shield { 0 } else { 1 },
            );
            let _ = write_reg_u32(
                HKEY_LOCAL_MACHINE,
                r"SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot",
                "TurnOffWindowsCopilot",
                target_val,
            );
        }
        "bing_search" => {
            let _ = write_reg_u32(
                HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\Search",
                "CortanaConsent",
                if enable_shield { 0 } else { 1 },
            );
        }
        "cortana" => {
            let _ = write_reg_u32(
                HKEY_LOCAL_MACHINE,
                r"SOFTWARE\Policies\Microsoft\Windows\Windows Search",
                "AllowCortana",
                if enable_shield { 0 } else { 1 },
            );
        }
        "suggested_apps" => {
            let _ = write_reg_u32(
                HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager",
                "SilentInstalledAppsEnabled",
                if enable_shield { 0 } else { 1 },
            );
        }
        "windows_tips" => {
            let _ = write_reg_u32(
                HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager",
                "SubscribedContent-338388Enabled",
                if enable_shield { 0 } else { 1 },
            );
            let _ = write_reg_u32(
                HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager",
                "SubscribedContent-338389Enabled",
                if enable_shield { 0 } else { 1 },
            );
            let _ = write_reg_u32(
                HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager",
                "SoftLandingEnabled",
                if enable_shield { 0 } else { 1 },
            );
        }
        "gamedvr" => {
            let _ = write_reg_u32(
                HKEY_LOCAL_MACHINE,
                r"SOFTWARE\Policies\Microsoft\Windows\GameDVR",
                "AllowGameDVR",
                if enable_shield { 0 } else { 1 },
            );
            let _ = write_reg_u32(
                HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\GameDVR",
                "AppCaptureEnabled",
                if enable_shield { 0 } else { 1 },
            );
        }
        "activity_history" => {
            let _ = write_reg_u32(
                HKEY_LOCAL_MACHINE,
                r"SOFTWARE\Policies\Microsoft\Windows\System",
                "PublishUserActivities",
                if enable_shield { 0 } else { 1 },
            );
            let _ = write_reg_u32(
                HKEY_CURRENT_USER,
                r"Software\Policies\Microsoft\Windows\System",
                "PublishUserActivities",
                if enable_shield { 0 } else { 1 },
            );
        }
        "typing_telemetry" => {
            let _ = write_reg_u32(
                HKEY_CURRENT_USER,
                r"Software\Microsoft\InputPersonalization",
                "RestrictImplicitTextCollection",
                if enable_shield { 1 } else { 0 },
            );
        }
        "edge_startup_boost" => {
            let _ = write_reg_u32(
                HKEY_LOCAL_MACHINE,
                r"SOFTWARE\Policies\Microsoft\Edge",
                "BackgroundModeEnabled",
                if enable_shield { 0 } else { 1 },
            );
        }
        _ => {}
    }

    Ok(())
}

pub fn apply_recommended_debloat() -> Result<usize, String> {
    let mut count = 0;
    for rule in RULES {
        if rule.recommended {
            if set_debloat_item(rule.id, true).is_ok() {
                count += 1;
            }
        }
    }
    Ok(count)
}

pub fn restore_windows_defaults() -> Result<usize, String> {
    let mut count = 0;
    for rule in RULES {
        if set_debloat_item(rule.id, false).is_ok() {
            count += 1;
        }
    }
    Ok(count)
}

fn check_rule_shielded(rule: &DebloatRule) -> bool {
    let reg = RegKey::predef(rule.hive);
    if let Ok(key) = reg.open_subkey_with_flags(rule.subkey, KEY_READ) {
        if let Ok(val) = key.get_value::<u32, _>(rule.value_name) {
            return val == rule.shield_val;
        }
    }
    // Check HKCU fallback for user policies
    if rule.hive == HKEY_LOCAL_MACHINE {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(key) = hkcu.open_subkey_with_flags(rule.subkey, KEY_READ) {
            if let Ok(val) = key.get_value::<u32, _>(rule.value_name) {
                return val == rule.shield_val;
            }
        }
    }
    false
}
