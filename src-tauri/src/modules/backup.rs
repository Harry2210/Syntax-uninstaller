use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::Duration;

use crate::modules::winproc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupRecord {
    pub id: String,
    pub backup_type: String, // "Registry", "FileFolder", "RestorePoint"
    pub target_name: String,
    pub file_path: String,
    pub size_bytes: u64,
    pub created_at: String,
    pub notes: String,
}

pub fn create_registry_backup(
    reg_key_path: &str,
    target_name: &str,
) -> Result<BackupRecord, String> {
    let backup_dir = get_backup_dir();
    std::fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;

    let filename = format!(
        "{}_{}.reg",
        target_name.replace(' ', "_"),
        chrono::Utc::now().format("%Y%m%d_%H%M%S")
    );
    let dest = backup_dir.join(&filename);

    let mut cmd = winproc::hidden("reg");
    cmd.args(["export", reg_key_path, dest.to_str().unwrap(), "/y"]);

    let output = winproc::run_with_timeout(cmd, Duration::from_secs(60))
        .map_err(|e| format!("Registry export command failed: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Registry export failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    let size = dest.metadata().map(|m| m.len()).unwrap_or(0);
    let id = uuid::Uuid::new_v4().to_string();

    Ok(BackupRecord {
        id,
        backup_type: "Registry".into(),
        target_name: target_name.to_string(),
        file_path: dest.to_string_lossy().to_string(),
        size_bytes: size,
        created_at: chrono::Utc::now().to_rfc3339(),
        notes: format!("Exported registry hive from {}", reg_key_path),
    })
}

pub fn restore_registry_backup(file_path: &str) -> Result<(), String> {
    let p = Path::new(file_path);
    if !p.exists() {
        return Err("Backup file does not exist".into());
    }

    let mut cmd = winproc::hidden("reg");
    cmd.args(["import", file_path]);

    let output = winproc::run_with_timeout(cmd, Duration::from_secs(60))
        .map_err(|e| format!("Registry import failed: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "Import error: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}

fn get_backup_dir() -> PathBuf {
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        PathBuf::from(local).join(r"SyntaxUninstaller\Backups")
    } else {
        PathBuf::from("./backups")
    }
}
