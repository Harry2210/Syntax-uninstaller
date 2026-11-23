use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

static DB: OnceLock<Database> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnownAppFootprint {
    pub id: String,
    pub app_name: String,
    pub publisher: String,
    pub known_keys: Vec<String>,
    pub known_folders: Vec<String>,
    pub silent_args: String,
    pub confidence_rating: f64,
}

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn global() -> &'static Database {
        DB.get_or_init(|| Database::init().expect("Failed to initialize SQLite database"))
    }

    pub fn init() -> Result<Self> {
        let mut db_path = dirs_or_local_data();
        std::fs::create_dir_all(&db_path).ok();
        db_path.push("syntax_uninstaller.db");

        let conn = Connection::open(&db_path)?;
        conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS uninstall_history (
                id TEXT PRIMARY KEY,
                app_name TEXT NOT NULL,
                publisher TEXT,
                version TEXT,
                uninstalled_at TEXT NOT NULL,
                status TEXT NOT NULL,
                leftovers_found INTEGER DEFAULT 0,
                leftovers_removed INTEGER DEFAULT 0,
                bytes_freed INTEGER DEFAULT 0,
                details TEXT
            );

            CREATE TABLE IF NOT EXISTS backups (
                id TEXT PRIMARY KEY,
                backup_type TEXT NOT NULL,
                target_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                size_bytes INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                notes TEXT
            );

            CREATE TABLE IF NOT EXISTS installation_traces (
                id TEXT PRIMARY KEY,
                app_name TEXT NOT NULL,
                recorded_at TEXT NOT NULL,
                registry_keys_added INTEGER DEFAULT 0,
                files_added INTEGER DEFAULT 0,
                total_size_bytes INTEGER DEFAULT 0,
                snapshot_data TEXT
            );

            CREATE TABLE IF NOT EXISTS logs_database (
                id TEXT PRIMARY KEY,
                app_name TEXT NOT NULL,
                publisher TEXT,
                known_keys TEXT,
                known_folders TEXT,
                silent_args TEXT,
                confidence_rating REAL DEFAULT 0.95,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                level TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                read INTEGER DEFAULT 0
            );
            ",
        )?;

        // Seed comprehensive application removal signatures if table has fewer than 20 items
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM logs_database", [], |row| row.get(0))
            .unwrap_or(0);

        if count < 15 {
            let seeds = [
                (
                    "Google Chrome",
                    "Google LLC",
                    "Software\\Google\\Chrome;Software\\Google\\Update",
                    "%LOCALAPPDATA%\\Google\\Chrome;%PROGRAMFILES%\\Google\\Chrome;%PROGRAMFILES(X86)%\\Google\\Chrome",
                    "--uninstall --multi-install --chrome --system-level",
                ),
                (
                    "Mozilla Firefox",
                    "Mozilla",
                    "Software\\Mozilla\\Firefox;Software\\MozillaPlugins",
                    "%APPDATA%\\Mozilla;%LOCALAPPDATA%\\Mozilla;%PROGRAMFILES%\\Mozilla Firefox",
                    "/S",
                ),
                (
                    "Discord",
                    "Discord Inc.",
                    "Software\\Discord",
                    "%APPDATA%\\discord;%LOCALAPPDATA%\\Discord",
                    "--uninstall",
                ),
                (
                    "Spotify",
                    "Spotify AB",
                    "Software\\Spotify",
                    "%APPDATA%\\Spotify;%LOCALAPPDATA%\\Spotify",
                    "/uninstall /silent",
                ),
                (
                    "Microsoft Teams",
                    "Microsoft Corporation",
                    "Software\\Microsoft\\Teams",
                    "%APPDATA%\\Microsoft\\Teams;%LOCALAPPDATA%\\Packages\\MSTeams_*",
                    "/uninstall /silent",
                ),
                (
                    "Slack",
                    "Slack Technologies",
                    "Software\\Slack",
                    "%APPDATA%\\Slack;%LOCALAPPDATA%\\slack",
                    "--uninstall -s",
                ),
                (
                    "Visual Studio Code",
                    "Microsoft Corporation",
                    "Software\\Microsoft\\Code",
                    "%APPDATA%\\Code;%USERPROFILE%\\.vscode",
                    "/VERYSILENT /NORESTART",
                ),
                (
                    "Steam",
                    "Valve Corporation",
                    "Software\\Valve\\Steam",
                    "%PROGRAMFILES(X86)%\\Steam;%LOCALAPPDATA%\\Steam",
                    "/S",
                ),
                (
                    "Epic Games Launcher",
                    "Epic Games, Inc.",
                    "Software\\Epic Games;Software\\EpicGames",
                    "%PROGRAMFILES(X86)%\\Epic Games;%LOCALAPPDATA%\\EpicGamesLauncher;%PROGRAMDATA%\\Epic",
                    "/quiet",
                ),
                (
                    "Adobe Creative Cloud",
                    "Adobe Systems",
                    "Software\\Adobe;Software\\Adobe\\CommonFiles",
                    "%PROGRAMFILES%\\Adobe;%PROGRAMFILES(X86)%\\Adobe;%PROGRAMFILES%\\Common Files\\Adobe;%APPDATA%\\Adobe;%LOCALAPPDATA%\\Adobe",
                    "/uninstall",
                ),
                (
                    "Adobe Photoshop",
                    "Adobe Inc.",
                    "Software\\Adobe\\Photoshop",
                    "%PROGRAMFILES%\\Adobe\\Adobe Photoshop;%APPDATA%\\Adobe\\Adobe Photoshop",
                    "/uninstall",
                ),
                (
                    "Adobe Acrobat",
                    "Adobe Systems",
                    "Software\\Adobe\\Adobe Acrobat;Software\\Adobe\\Acrobat Reader",
                    "%PROGRAMFILES%\\Adobe\\Acrobat;%APPDATA%\\Adobe\\Acrobat",
                    "/sAll /rs /msi",
                ),
                (
                    "Autodesk AutoCAD",
                    "Autodesk",
                    "Software\\Autodesk;Software\\Autodesk\\AutoCAD",
                    "%PROGRAMFILES%\\Autodesk;%PROGRAMDATA%\\Autodesk;%APPDATA%\\Autodesk;%LOCALAPPDATA%\\Autodesk",
                    "/quiet",
                ),
                (
                    "Zoom",
                    "Zoom Video Communications",
                    "Software\\ZoomUMX",
                    "%APPDATA%\\Zoom;%LOCALAPPDATA%\\Zoom;%PROGRAMFILES%\\Zoom",
                    "/uninstall",
                ),
                (
                    "Telegram Desktop",
                    "Telegram FZ-LLC",
                    "Software\\Telegram",
                    "%APPDATA%\\Telegram Desktop",
                    "/VERYSILENT",
                ),
                (
                    "WhatsApp",
                    "WhatsApp LLC",
                    "Software\\WhatsApp",
                    "%LOCALAPPDATA%\\WhatsApp",
                    "/uninstall",
                ),
                (
                    "Dropbox",
                    "Dropbox, Inc.",
                    "Software\\Dropbox",
                    "%APPDATA%\\Dropbox;%LOCALAPPDATA%\\Dropbox;%PROGRAMFILES(X86)%\\Dropbox",
                    "/uninstall",
                ),
                (
                    "Microsoft OneDrive",
                    "Microsoft Corporation",
                    "Software\\Microsoft\\OneDrive",
                    "%LOCALAPPDATA%\\Microsoft\\OneDrive;%PROGRAMDATA%\\Microsoft OneDrive",
                    "/uninstall",
                ),
                (
                    "VLC media player",
                    "VideoLAN",
                    "Software\\VideoLAN\\VLC",
                    "%APPDATA%\\vlc;%PROGRAMFILES%\\VideoLAN\\VLC",
                    "/S",
                ),
                (
                    "7-Zip",
                    "Igor Pavlov",
                    "Software\\7-Zip",
                    "%PROGRAMFILES%\\7-Zip",
                    "/S",
                ),
                (
                    "WinRAR",
                    "win.rar GmbH",
                    "Software\\WinRAR",
                    "%PROGRAMFILES%\\WinRAR;%APPDATA%\\WinRAR",
                    "/S",
                ),
                (
                    "Notepad++",
                    "Notepad++ Team",
                    "Software\\Notepad++",
                    "%PROGRAMFILES%\\Notepad++;%PROGRAMFILES(X86)%\\Notepad++;%APPDATA%\\Notepad++",
                    "/S",
                ),
                (
                    "AnyDesk",
                    "AnyDesk Software GmbH",
                    "Software\\AnyDesk",
                    "%PROGRAMFILES(X86)%\\AnyDesk;%APPDATA%\\AnyDesk",
                    "--remove --silent",
                ),
                (
                    "TeamViewer",
                    "TeamViewer Germany GmbH",
                    "Software\\TeamViewer",
                    "%PROGRAMFILES%\\TeamViewer;%PROGRAMFILES(X86)%\\TeamViewer;%APPDATA%\\TeamViewer",
                    "/S",
                ),
                (
                    "OBS Studio",
                    "OBS Project",
                    "Software\\OBS Studio",
                    "%PROGRAMFILES%\\obs-studio;%APPDATA%\\obs-studio",
                    "/S",
                ),
                (
                    "Node.js",
                    "OpenJS Foundation",
                    "Software\\Node.js",
                    "%PROGRAMFILES%\\nodejs;%APPDATA%\\npm;%APPDATA%\\npm-cache",
                    "/quiet",
                ),
                (
                    "Python",
                    "Python Software Foundation",
                    "Software\\Python",
                    "%LOCALAPPDATA%\\Programs\\Python",
                    "/uninstall /quiet",
                ),
                (
                    "Git",
                    "The Git Development Community",
                    "Software\\GitForWindows",
                    "%PROGRAMFILES%\\Git;%LOCALAPPDATA%\\Programs\\Git",
                    "/VERYSILENT /NORESTART",
                ),
                (
                    "CCleaner",
                    "Piriform",
                    "Software\\Piriform\\CCleaner",
                    "%PROGRAMFILES%\\CCleaner;%APPDATA%\\CCleaner",
                    "/S",
                ),
                (
                    "Malwarebytes",
                    "Malwarebytes",
                    "Software\\Malwarebytes",
                    "%PROGRAMFILES%\\Malwarebytes;%PROGRAMDATA%\\Malwarebytes",
                    "/VERYSILENT",
                ),
            ];

            for (app, publ, keys, folders, silent) in seeds {
                let id = uuid::Uuid::new_v4().to_string();
                let now = chrono::Utc::now().to_rfc3339();
                conn.execute(
                    "INSERT OR REPLACE INTO logs_database (id, app_name, publisher, known_keys, known_folders, silent_args, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![id, app, publ, keys, folders, silent, now],
                ).ok();
            }
        }

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn find_matching_footprints(
        &self,
        app_name: &str,
        publisher: &str,
    ) -> Vec<KnownAppFootprint> {
        let conn = match self.conn.lock() {
            Ok(c) => c,
            Err(_) => return Vec::new(),
        };

        let app_clean = app_name.trim().to_lowercase();
        let pub_clean = publisher.trim().to_lowercase();

        let mut stmt = match conn.prepare(
            "SELECT id, app_name, publisher, known_keys, known_folders, silent_args, confidence_rating 
             FROM logs_database"
        ) {
            Ok(s) => s,
            Err(_) => return Vec::new(),
        };

        let rows = stmt.query_map([], |row| {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            let publ: String = row.get(2).unwrap_or_default();
            let keys_str: String = row.get(3).unwrap_or_default();
            let folders_str: String = row.get(4).unwrap_or_default();
            let silent: String = row.get(5).unwrap_or_default();
            let conf: f64 = row.get(6).unwrap_or(0.95);

            Ok(KnownAppFootprint {
                id,
                app_name: name,
                publisher: publ,
                known_keys: keys_str
                    .split(';')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect(),
                known_folders: folders_str
                    .split(';')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect(),
                silent_args: silent,
                confidence_rating: conf,
            })
        });

        let mut matches = Vec::new();
        if let Ok(mapped) = rows {
            for item in mapped.filter_map(|r| r.ok()) {
                let db_app = item.app_name.to_lowercase();
                let db_pub = item.publisher.to_lowercase();

                let is_match = app_clean.contains(&db_app)
                    || db_app.contains(&app_clean)
                    || (!pub_clean.is_empty()
                        && (pub_clean.contains(&db_pub) || db_pub.contains(&pub_clean)));

                if is_match {
                    matches.push(item);
                }
            }
        }

        matches
    }

    pub fn get_all_footprints(&self) -> Result<Vec<KnownAppFootprint>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, app_name, publisher, known_keys, known_folders, silent_args, confidence_rating FROM logs_database ORDER BY app_name ASC")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                let id: String = row.get(0)?;
                let name: String = row.get(1)?;
                let publ: String = row.get(2).unwrap_or_default();
                let keys_str: String = row.get(3).unwrap_or_default();
                let folders_str: String = row.get(4).unwrap_or_default();
                let silent: String = row.get(5).unwrap_or_default();
                let conf: f64 = row.get(6).unwrap_or(0.95);

                Ok(KnownAppFootprint {
                    id,
                    app_name: name,
                    publisher: publ,
                    known_keys: keys_str
                        .split(';')
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect(),
                    known_folders: folders_str
                        .split(';')
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect(),
                    silent_args: silent,
                    confidence_rating: conf,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut result = Vec::new();
        for item in rows.filter_map(|r| r.ok()) {
            result.push(item);
        }
        Ok(result)
    }

    pub fn save_installation_trace(
        &self,
        trace: &crate::modules::monitor::InstallationTrace,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let snapshot_json = serde_json::to_string(trace).map_err(|e| e.to_string())?;

        conn.execute(
            "INSERT OR REPLACE INTO installation_traces 
             (id, app_name, recorded_at, registry_keys_added, files_added, total_size_bytes, snapshot_data) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                trace.id,
                trace.app_name,
                trace.recorded_at,
                trace.new_registry_keys.len() as i64,
                trace.new_files.len() as i64,
                trace.total_size_bytes as i64,
                snapshot_json
            ],
        ).map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn get_installation_traces(
        &self,
    ) -> Result<Vec<crate::modules::monitor::InstallationTrace>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT snapshot_data FROM installation_traces ORDER BY recorded_at DESC")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                let data_str: String = row.get(0)?;
                Ok(data_str)
            })
            .map_err(|e| e.to_string())?;

        let mut traces = Vec::new();
        for raw in rows.filter_map(|r| r.ok()) {
            if let Ok(trace) =
                serde_json::from_str::<crate::modules::monitor::InstallationTrace>(&raw)
            {
                traces.push(trace);
            }
        }
        Ok(traces)
    }

    pub fn delete_installation_trace(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM installation_traces WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

fn dirs_or_local_data() -> PathBuf {
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        PathBuf::from(local_app_data).join("SyntaxUninstaller")
    } else {
        PathBuf::from("./data")
    }
}
