use serde::{Deserialize, Serialize};
use winreg::enums::*;
use winreg::RegKey;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextMenuItem {
    pub id: String,
    pub name: String,
    pub menu_type: String, // "Files (*)", "Folders", "Desktop Background", "Drives"
    pub registry_path: String,
    pub clsid: String,
    pub enabled: bool,
    pub is_system: bool,
}

pub fn get_context_menu_items() -> Vec<ContextMenuItem> {
    let mut items = Vec::new();

    let targets = [
        (r"*\shellex\ContextMenuHandlers", "Files (*)"),
        (r"Directory\shellex\ContextMenuHandlers", "Folders"),
        (
            r"Directory\Background\shellex\ContextMenuHandlers",
            "Desktop Background",
        ),
        (r"Drive\shellex\ContextMenuHandlers", "Drives"),
    ];

    let hkcr = RegKey::predef(HKEY_CLASSES_ROOT);

    for (subpath, type_label) in &targets {
        if let Ok(key) = hkcr.open_subkey_with_flags(subpath, KEY_READ) {
            for subkey_name in key.enum_keys().filter_map(|x| x.ok()) {
                let is_disabled = subkey_name.starts_with('-');
                let clean_name = if is_disabled {
                    subkey_name[1..].to_string()
                } else {
                    subkey_name.clone()
                };

                let full_path = format!(r"HKCR\{}\{}", subpath, subkey_name);

                let clsid: String = key
                    .open_subkey_with_flags(&subkey_name, KEY_READ)
                    .and_then(|k| k.get_value(""))
                    .unwrap_or_default();

                let is_system = clean_name.to_lowercase().contains("windows")
                    || clean_name.to_lowercase().contains("sharing")
                    || clean_name.to_lowercase().contains("openwith")
                    || clean_name.starts_with('{');

                items.push(ContextMenuItem {
                    id: uuid::Uuid::new_v4().to_string(),
                    name: clean_name,
                    menu_type: (*type_label).to_string(),
                    registry_path: full_path,
                    clsid,
                    enabled: !is_disabled,
                    is_system,
                });
            }
        }
    }

    items.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    items
}

pub fn toggle_context_menu_item(registry_path: &str, enable: bool) -> Result<(), String> {
    // Expected format: HKCR\<subpath>\<subkey_name>
    if !registry_path.starts_with(r"HKCR\") {
        return Err("Invalid registry path".into());
    }

    let rel_path = &registry_path[5..];
    let last_slash = rel_path
        .rfind('\\')
        .ok_or_else(|| "Malformed path".to_string())?;
    let parent_path = &rel_path[..last_slash];
    let current_name = &rel_path[last_slash + 1..];

    let hkcr = RegKey::predef(HKEY_CLASSES_ROOT);
    let parent = hkcr
        .open_subkey_with_flags(parent_path, KEY_READ | KEY_WRITE)
        .map_err(|e| format!("Cannot open parent key '{}': {}", parent_path, e))?;

    let is_currently_disabled = current_name.starts_with('-');

    if enable && is_currently_disabled {
        // Strip leading '-'
        let target_name = &current_name[1..];
        copy_and_delete_subkey(&parent, current_name, target_name)?;
    } else if !enable && !is_currently_disabled {
        // Add leading '-'
        let target_name = format!("-{}", current_name);
        copy_and_delete_subkey(&parent, current_name, &target_name)?;
    }

    Ok(())
}

pub fn delete_context_menu_item(registry_path: &str) -> Result<(), String> {
    if !registry_path.starts_with(r"HKCR\") {
        return Err("Invalid registry path".into());
    }

    let rel_path = &registry_path[5..];
    let last_slash = rel_path
        .rfind('\\')
        .ok_or_else(|| "Malformed path".to_string())?;
    let parent_path = &rel_path[..last_slash];
    let subkey_to_delete = &rel_path[last_slash + 1..];

    let hkcr = RegKey::predef(HKEY_CLASSES_ROOT);
    let parent = hkcr
        .open_subkey_with_flags(parent_path, KEY_WRITE)
        .map_err(|e| format!("Cannot open parent key '{}': {}", parent_path, e))?;

    parent
        .delete_subkey_all(subkey_to_delete)
        .map_err(|e| format!("Failed to delete context menu item: {}", e))
}

fn copy_and_delete_subkey(parent: &RegKey, from_name: &str, to_name: &str) -> Result<(), String> {
    let src = parent
        .open_subkey_with_flags(from_name, KEY_READ)
        .map_err(|e| format!("Failed to open '{}': {}", from_name, e))?;

    let (dest, _) = parent
        .create_subkey_with_flags(to_name, KEY_WRITE)
        .map_err(|e| format!("Failed to create '{}': {}", to_name, e))?;

    // Copy default value
    if let Ok(def_val) = src.get_value::<String, _>("") {
        let _ = dest.set_value("", &def_val);
    }

    // Delete source
    let _ = parent.delete_subkey_all(from_name);
    Ok(())
}
