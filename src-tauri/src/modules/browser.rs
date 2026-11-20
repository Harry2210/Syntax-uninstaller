use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserExtension {
    pub id: String,
    pub name: String,
    pub version: String,
    pub browser: String,
    pub profile: String,
    pub enabled: bool,
    pub path: String,
}

pub fn get_installed_extensions() -> Vec<BrowserExtension> {
    let mut list = Vec::new();

    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let base = PathBuf::from(local_app_data);

        // Chrome Default & Profile 1
        scan_chromium_extensions(
            &base.join(r"Google\Chrome\User Data\Default\Extensions"),
            "Google Chrome",
            "Default",
            &mut list,
        );
        scan_chromium_extensions(
            &base.join(r"Google\Chrome\User Data\Profile 1\Extensions"),
            "Google Chrome",
            "Profile 1",
            &mut list,
        );

        // Edge Default & Profile 1
        scan_chromium_extensions(
            &base.join(r"Microsoft\Edge\User Data\Default\Extensions"),
            "Microsoft Edge",
            "Default",
            &mut list,
        );
        scan_chromium_extensions(
            &base.join(r"Microsoft\Edge\User Data\Profile 1\Extensions"),
            "Microsoft Edge",
            "Profile 1",
            &mut list,
        );
    }

    if let Ok(app_data) = std::env::var("APPDATA") {
        let firefox_profiles = PathBuf::from(app_data).join(r"Mozilla\Firefox\Profiles");
        if firefox_profiles.exists() {
            if let Ok(entries) = fs::read_dir(firefox_profiles) {
                for entry in entries.filter_map(|e| e.ok()) {
                    let ext_dir = entry.path().join("extensions");
                    if ext_dir.exists() {
                        scan_firefox_extensions(
                            &ext_dir,
                            &entry.file_name().to_string_lossy(),
                            &mut list,
                        );
                    }
                }
            }
        }
    }

    list
}

fn scan_chromium_extensions(
    ext_dir: &Path,
    browser: &str,
    profile: &str,
    list: &mut Vec<BrowserExtension>,
) {
    if !ext_dir.exists() {
        return;
    }

    if let Ok(entries) = fs::read_dir(ext_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let ext_id = entry.file_name().to_string_lossy().to_string();
            // Read highest version folder
            if let Ok(vers) = fs::read_dir(entry.path()) {
                for ver_entry in vers.filter_map(|v| v.ok()) {
                    let manifest_file = ver_entry.path().join("manifest.json");
                    if manifest_file.exists() {
                        if let Ok(content) = fs::read_to_string(&manifest_file) {
                            let (name, ver) = parse_manifest_simple(&content, &ext_id);
                            list.push(BrowserExtension {
                                id: ext_id.clone(),
                                name,
                                version: ver,
                                browser: browser.to_string(),
                                profile: profile.to_string(),
                                enabled: true,
                                path: ver_entry.path().to_string_lossy().to_string(),
                            });
                            break;
                        }
                    }
                }
            }
        }
    }
}

fn scan_firefox_extensions(ext_dir: &Path, profile: &str, list: &mut Vec<BrowserExtension>) {
    if let Ok(entries) = fs::read_dir(ext_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            let name = path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            list.push(BrowserExtension {
                id: name.clone(),
                name: format!("Firefox Add-on ({})", name),
                version: "Current".to_string(),
                browser: "Mozilla Firefox".to_string(),
                profile: profile.to_string(),
                enabled: true,
                path: path.to_string_lossy().to_string(),
            });
        }
    }
}

fn parse_manifest_simple(content: &str, fallback_id: &str) -> (String, String) {
    if let Ok(val) = serde_json::from_str::<serde_json::Value>(content) {
        let mut name = val
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or(fallback_id)
            .to_string();
        if name.starts_with("__MSG_") {
            // Localization placeholder, use friendly fallback
            name = format!("Extension ({})", fallback_id);
        }
        let version = val
            .get("version")
            .and_then(|v| v.as_str())
            .unwrap_or("1.0")
            .to_string();
        (name, version)
    } else {
        (fallback_id.to_string(), "1.0".to_string())
    }
}
