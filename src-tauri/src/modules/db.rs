use rusqlite::{params, Connection, Result};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
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

        // Seed some known application removal profiles if empty
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM logs_database", [], |row| row.get(0))
            .unwrap_or(0);

        if count == 0 {
            let seeds = [
                (
                    "Google Chrome",
                    "Google LLC",
                    "Software\\Google\\Chrome;Software\\Google\\Update",
                    "%LOCALAPPDATA%\\Google\\Chrome;%PROGRAMFILES%\\Google\\Chrome",
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
                    "%PROGRAMFILES(X86)%\\Steam",
                    "/S",
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
            ];

            for (app, publ, keys, folders, silent) in seeds {
                let id = uuid::Uuid::new_v4().to_string();
                let now = chrono::Utc::now().to_rfc3339();
                conn.execute(
                    "INSERT INTO logs_database (id, app_name, publisher, known_keys, known_folders, silent_args, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![id, app, publ, keys, folders, silent, now],
                ).ok();
            }
        }

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }
}

fn dirs_or_local_data() -> PathBuf {
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        PathBuf::from(local_app_data).join("SyntaxUninstaller")
    } else {
        PathBuf::from("./data")
    }
}
