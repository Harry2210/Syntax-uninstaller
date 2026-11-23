use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use crate::modules::cache;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanCategory {
    pub id: String,
    pub name: String,
    pub description: String,
    pub target_paths: Vec<String>,
    pub file_count: usize,
    pub total_size_bytes: u64,
    pub selected: bool,
}

/// Describes one independent cleanup category before it is scanned.
struct ScanSpec {
    id: &'static str,
    name: &'static str,
    description: &'static str,
    path: PathBuf,
    max_files: usize,
    selected: bool,
}

impl ScanSpec {
    fn new(
        id: &'static str,
        name: &'static str,
        description: &'static str,
        path: PathBuf,
        max_files: usize,
        selected: bool,
    ) -> Self {
        Self {
            id,
            name,
            description,
            path,
            max_files,
            selected,
        }
    }
}

/// Runs independent directory walks on their own threads and preserves the
/// order of `specs`.
///
/// Cleanup categories do not share state and are usually on different parts of
/// the disk, so scanning them one after another wasted most of the available
/// I/O parallelism. Threads are scoped, so no scan can outlive the caller.
fn scan_specs_parallel(specs: Vec<ScanSpec>) -> Vec<CleanCategory> {
    if specs.is_empty() {
        return Vec::new();
    }

    let slot_count = specs.len();
    let slots: Mutex<Vec<Option<CleanCategory>>> =
        Mutex::new((0..slot_count).map(|_| None).collect());

    std::thread::scope(|scope| {
        for (index, spec) in specs.into_iter().enumerate() {
            let slots = &slots;
            scope.spawn(move || {
                let (count, size, paths) = scan_directory_files(&spec.path, spec.max_files);
                let category = CleanCategory {
                    id: spec.id.to_string(),
                    name: spec.name.to_string(),
                    description: spec.description.to_string(),
                    target_paths: paths,
                    file_count: count,
                    total_size_bytes: size,
                    selected: spec.selected,
                };
                if let Ok(mut guard) = slots.lock() {
                    guard[index] = Some(category);
                }
            });
        }
    });

    slots
        .into_inner()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .into_iter()
        .flatten()
        .collect()
}

pub fn scan_junk_categories() -> Vec<CleanCategory> {
    let mut specs = Vec::new();

    // 1. User Temp
    if let Ok(temp) = std::env::var("TEMP") {
        specs.push(ScanSpec::new(
            "user_temp",
            "User Temporary Files",
            "Temporary application scratch data, installers, and transient caches",
            PathBuf::from(temp),
            2000,
            true,
        ));
    }

    // 2. Windows Temp
    let win_temp = Path::new(r"C:\Windows\Temp");
    if win_temp.exists() {
        specs.push(ScanSpec::new(
            "win_temp",
            "System Temporary Files",
            "Operating system installers, updates, and system-level scratch files",
            win_temp.to_path_buf(),
            1000,
            true,
        ));
    }

    // 3. Application Crash Dumps
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let dumps = PathBuf::from(&local).join("CrashDumps");
        if dumps.exists() {
            specs.push(ScanSpec::new(
                "crash_dumps",
                "Application Crash Dumps",
                "Memory core dumps (.dmp) left behind by crashed processes",
                dumps,
                500,
                true,
            ));
        }
    }

    // 4. Windows Error Reporting (WER)
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let wer = PathBuf::from(&local).join(r"Microsoft\Windows\WER\ReportArchive");
        if wer.exists() {
            specs.push(ScanSpec::new(
                "wer_reports",
                "Windows Error Reports",
                "Archived telemetry, fault queues, and diagnostic crash logs",
                wer,
                500,
                true,
            ));
        }
    }

    // 5. Windows Update Delivery Optimization Cache
    let deliv_opt = Path::new(r"C:\Windows\SoftwareDistribution\Download");
    if deliv_opt.exists() {
        specs.push(ScanSpec::new(
            "win_update_cache",
            "Windows Update Download Cache",
            "Downloaded cumulative update packages and staged installation files",
            deliv_opt.to_path_buf(),
            1000,
            true,
        ));
    }

    // 6. Windows Prefetch Cache
    let prefetch = Path::new(r"C:\Windows\Prefetch");
    if prefetch.exists() {
        specs.push(ScanSpec::new(
            "win_prefetch",
            "Windows Prefetch Cache",
            "Old application prefetch traces and stale execution metadata",
            prefetch.to_path_buf(),
            1000,
            false,
        ));
    }

    scan_specs_parallel(specs)
}

pub fn scan_windows_traces() -> Vec<CleanCategory> {
    let mut specs = Vec::new();

    // 1. Recent Document History
    if let Ok(appdata) = std::env::var("APPDATA") {
        let recent = PathBuf::from(&appdata).join(r"Microsoft\Windows\Recent");
        if recent.exists() {
            specs.push(ScanSpec::new(
                "win_recent",
                "Recent Document History",
                "Shortcuts and jumps to recently opened files, folders, and documents",
                recent,
                200,
                true,
            ));
        }
    }

    // 2. Thumbnail Cache
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let explorer = PathBuf::from(&local).join(r"Microsoft\Windows\Explorer");
        if explorer.exists() {
            specs.push(ScanSpec::new(
                "win_thumbs",
                "Explorer Thumbnail Cache",
                "Cached preview thumbnails (thumbcache_*.db) for images and videos",
                explorer,
                100,
                false,
            ));
        }
    }

    // 3. Windows Font Cache
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let font_cache = PathBuf::from(&local).join("FontCache");
        if font_cache.exists() {
            specs.push(ScanSpec::new(
                "win_font_cache",
                "DirectWrite Font Cache",
                "Cached glyph metrics and font rendering data",
                font_cache,
                50,
                false,
            ));
        }
    }

    scan_specs_parallel(specs)
}

pub fn scan_browser_traces() -> Vec<CleanCategory> {
    let mut specs = Vec::new();

    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let local_path = PathBuf::from(&local);

        let browsers = [
            (
                "chrome_cache",
                "Google Chrome Cache",
                "Cached website assets, stylesheets, script payloads, and images",
                r"Google\Chrome\User Data\Default\Cache\Cache_Data",
            ),
            (
                "edge_cache",
                "Microsoft Edge Cache",
                "Cached web resources and temporary internet files in Microsoft Edge",
                r"Microsoft\Edge\User Data\Default\Cache\Cache_Data",
            ),
            (
                "brave_cache",
                "Brave Browser Cache",
                "Temporary web cache files from Brave Browser",
                r"BraveSoftware\Brave-Browser\User Data\Default\Cache\Cache_Data",
            ),
            (
                "opera_cache",
                "Opera Browser Cache",
                "Cached web page assets and scripts from Opera",
                r"Opera Software\Opera Stable\Cache\Cache_Data",
            ),
        ];

        for (id, name, description, relative) in browsers {
            let cache_path = local_path.join(relative);
            if cache_path.exists() {
                specs.push(ScanSpec::new(
                    id,
                    name,
                    description,
                    cache_path,
                    if id == "brave_cache" || id == "opera_cache" {
                        200
                    } else {
                        250
                    },
                    true,
                ));
            }
        }
    }

    scan_specs_parallel(specs)
}

pub fn scan_office_traces() -> Vec<CleanCategory> {
    let mut specs = Vec::new();

    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let office_cache = PathBuf::from(&local).join(r"Microsoft\Office\16.0\OfficeFileCache");
        if office_cache.exists() {
            specs.push(ScanSpec::new(
                "office_cache",
                "Microsoft Office File Cache",
                "Cached synchronized Office 365 / Office 2021 documents and templates",
                office_cache,
                100,
                true,
            ));
        }
    }

    if let Ok(appdata) = std::env::var("APPDATA") {
        let office_recent = PathBuf::from(&appdata).join(r"Microsoft\Office\Recent");
        if office_recent.exists() {
            specs.push(ScanSpec::new(
                "office_recent",
                "Office Recent Files History",
                "Shortcuts to recently accessed Word, Excel, and PowerPoint files",
                office_recent,
                100,
                true,
            ));
        }
    }

    scan_specs_parallel(specs)
}

#[allow(clippy::permissions_set_readonly_false)]
pub fn clean_files(file_paths: &[String]) -> (usize, u64, Vec<String>) {
    let mut cleaned = 0;
    let mut bytes = 0;
    let mut errors = Vec::new();

    for p_str in file_paths {
        let p = Path::new(p_str);
        if p.exists() {
            let size = p.metadata().map(|m| m.len()).unwrap_or(0);

            // 1. Remove readonly attribute if present
            if let Ok(meta) = p.metadata() {
                let mut perms = meta.permissions();
                if perms.readonly() {
                    perms.set_readonly(false);
                    let _ = fs::set_permissions(p, perms);
                }
            }

            // 2. Try standard deletion
            let remove_res = if p.is_file() {
                fs::remove_file(p)
            } else if p.is_dir() {
                fs::remove_dir_all(p)
            } else {
                continue;
            };

            match remove_res {
                Ok(_) => {
                    cleaned += 1;
                    bytes += size;
                }
                Err(err) => {
                    // If access denied on Windows system directories, try best-effort cmd deletion
                    let path_low = p_str.to_lowercase();
                    if err.kind() == std::io::ErrorKind::PermissionDenied
                        && (path_low.contains("windows\\temp")
                            || path_low.contains("softwaredistribution"))
                    {
                        let cmd_del = std::process::Command::new("cmd")
                            .args(["/c", "del", "/f", "/q", "/a", p_str])
                            .output();
                        if let Ok(out) = cmd_del {
                            if out.status.success() && !p.exists() {
                                cleaned += 1;
                                bytes += size;
                                continue;
                            }
                        }
                    }
                    errors.push(format!("Cannot remove '{}': {}", p_str, err));
                }
            }
        }
    }

    // Cached disk maps describe the previous state of the volume.
    cache::invalidate("space:");
    (cleaned, bytes, errors)
}

pub fn secure_shred_files(file_paths: &[String], passes: u32) -> (usize, u64, Vec<String>) {
    let mut shredded = 0;
    let mut bytes = 0;
    let mut errors = Vec::new();

    let safe_passes = passes.clamp(1, 7);

    for p_str in file_paths {
        let p = Path::new(p_str);
        if p.is_file() {
            if let Ok(meta) = p.metadata() {
                let size = meta.len();

                // Multi-pass overwrite (DoD 5220.22-M style)
                let mut overwrite_success = true;
                if let Ok(mut file) = OpenOptions::new().write(true).open(p) {
                    for pass in 0..safe_passes {
                        let fill_byte: u8 = match pass % 3 {
                            0 => 0x00,
                            1 => 0xFF,
                            _ => 0xAA,
                        };
                        let chunk = vec![fill_byte; 64 * 1024];
                        let mut written = 0u64;

                        while written < size {
                            let to_write =
                                std::cmp::min(chunk.len() as u64, size - written) as usize;
                            if file.write_all(&chunk[..to_write]).is_err() {
                                overwrite_success = false;
                                break;
                            }
                            written += to_write as u64;
                        }

                        let _ = file.flush();
                    }
                } else {
                    overwrite_success = false;
                }

                if overwrite_success {
                    let _ = fs::remove_file(p);
                    shredded += 1;
                    bytes += size;
                } else {
                    errors.push(format!("Failed to securely shred '{}'", p_str));
                }
            }
        }
    }

    cache::invalidate("space:");
    (shredded, bytes, errors)
}

fn scan_directory_files(dir: &Path, max_files: usize) -> (usize, u64, Vec<String>) {
    let mut count = 0;
    let mut total_size = 0u64;
    let mut paths = Vec::new();

    if !dir.exists() || !dir.is_dir() {
        return (0, 0, paths);
    }

    let max_scan_entries = 10000;
    for entry in walkdir::WalkDir::new(dir)
        .max_depth(4)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            if let Ok(meta) = entry.metadata() {
                count += 1;
                total_size += meta.len();
                if paths.len() < max_files {
                    paths.push(entry.path().to_string_lossy().to_string());
                }
            }
        }
        if count >= max_scan_entries {
            break;
        }
    }

    (count, total_size, paths)
}
