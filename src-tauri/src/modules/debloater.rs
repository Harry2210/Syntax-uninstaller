use serde::{Deserialize, Serialize};
use winreg::enums::*;
use winreg::RegKey;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebloatItem {
    pub id: String,
    pub name: String,
    pub category: String, // "Telemetry & Privacy", "Windows AI & Features", "Taskbar & Search", "Edge & Background"
    pub description: String,
    pub is_shielded: bool, // true if privacy protection is applied (telemetry disabled)
    pub recommended: bool,
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
}

const RULES: &[DebloatRule] = &[
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
    },
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
    },
    DebloatRule {
        id: "windows_copilot",
        name: "Windows Copilot AI Assistant",
        category: "Windows AI & Features",
        description: "Disables the background Copilot runtime and unpins the AI assistant sidebar icon.",
        recommended: true,
        hive: HKEY_CURRENT_USER,
        subkey: r"Software\Policies\Microsoft\Windows\WindowsCopilot",
        value_name: "TurnOffWindowsCopilot",
        shield_val: 1,
        default_val: 0,
    },
    DebloatRule {
        id: "windows_recall",
        name: "Windows Recall AI Snapshots",
        category: "Windows AI & Features",
        description: "Prevents Windows from taking periodic background desktop screenshots for local AI indexing.",
        recommended: true,
        hive: HKEY_CURRENT_USER,
        subkey: r"Software\Policies\Microsoft\Windows\WindowsAI",
        value_name: "DisableAIDataAnalysis",
        shield_val: 1,
        default_val: 0,
    },
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
    },
    DebloatRule {
        id: "feedback_frequency",
        name: "Automated Feedback Requests",
        category: "Telemetry & Privacy",
        description: "Silences recurring Windows feedback prompts and satisfaction surveys.",
        recommended: true,
        hive: HKEY_CURRENT_USER,
        subkey: r"Software\Microsoft\Siuf\Rules",
        value_name: "NumberOfSIUFInPeriod",
        shield_val: 0,
        default_val: 1,
    },
    DebloatRule {
        id: "location_sensor",
        name: "Global Location & Sensor Tracking",
        category: "Telemetry & Privacy",
        description: "Blocks background geolocation sensor polling by third-party Windows apps.",
        recommended: false,
        hive: HKEY_LOCAL_MACHINE,
        subkey: r"SOFTWARE\Policies\Microsoft\Windows\LocationAndSensors",
        value_name: "DisableLocation",
        shield_val: 1,
        default_val: 0,
    },
];

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

    let reg = RegKey::predef(rule.hive);
    let (key, _) = reg
        .create_subkey_with_flags(rule.subkey, KEY_WRITE)
        .map_err(|e| format!("Registry error opening '{}': {}", rule.subkey, e))?;

    key.set_value(rule.value_name, &target_val)
        .map_err(|e| format!("Failed to set registry value '{}': {}", rule.value_name, e))
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
    false
}
