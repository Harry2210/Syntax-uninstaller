//! Read-only disk space analysis.
//!
//! The scanner walks a folder tree with a small, bounded worker pool so large
//! volumes finish quickly without starting one thread per directory. It is
//! deliberately conservative:
//!
//! * it never follows reparse points, junctions or symlinks;
//! * it stops after a time/entry budget instead of running for minutes;
//! * it never deletes, renames or opens user files for writing;
//! * it reports inaccessible folders instead of failing the whole scan.
//!
//! Results are cached briefly so drilling into a folder and going back does
//! not re-walk gigabytes of unchanged data.

use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::{BinaryHeap, HashMap, HashSet, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering as AtomicOrdering};
use std::sync::{Condvar, Mutex};
use std::time::{Duration, Instant};

pub const CACHE_TTL: Duration = Duration::from_secs(45);

const MAX_ENTRIES: u64 = 900_000;
const MAX_DURATION: Duration = Duration::from_secs(20);
const TOP_FILES_LIMIT: usize = 25;
const TOP_FOLDERS_LIMIT: usize = 40;
const WORKER_LIMIT: usize = 8;
const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpaceEntry {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub file_count: u64,
    pub is_dir: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpaceCategory {
    pub name: String,
    pub size_bytes: u64,
    pub file_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpaceReport {
    pub root: String,
    pub scanned_at: String,
    pub duration_ms: u64,
    pub total_bytes: u64,
    pub file_count: u64,
    pub folder_count: u64,
    pub inaccessible: u64,
    pub truncated: bool,
    pub top_folders: Vec<SpaceEntry>,
    pub top_files: Vec<SpaceEntry>,
    pub categories: Vec<SpaceCategory>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpaceScanProgress {
    pub root: String,
    pub scanned_bytes: u64,
    pub file_count: u64,
    pub folder_count: u64,
    pub current_path: String,
    pub elapsed_ms: u64,
}

/// Turns a user-supplied path into a canonical folder path.
///
/// `%TEMP%`-style environment variables are expanded so the UI can offer
/// shortcuts without guessing the user's profile layout.
pub fn resolve_path(raw: &str) -> Result<PathBuf, String> {
    let expanded = expand_environment(raw.trim());
    if expanded.is_empty() {
        return Err("Enter a folder or drive to scan.".to_string());
    }

    let candidate = PathBuf::from(&expanded);
    if !candidate.exists() {
        return Err(format!("That path does not exist: {}", expanded));
    }
    if !candidate.is_dir() {
        return Err(format!("That path is a file, not a folder: {}", expanded));
    }

    candidate
        .canonicalize()
        .map_err(|error| format!("Could not resolve '{}': {}", expanded, error))
}

/// Strips the Windows extended-length prefix for display.
pub fn display_path(path: &Path) -> String {
    let text = path.to_string_lossy();
    text.strip_prefix(r"\\?\").unwrap_or(&text).to_string()
}

fn expand_environment(raw: &str) -> String {
    if !raw.contains('%') {
        return raw.to_string();
    }

    let mut result = String::with_capacity(raw.len());
    let mut rest = raw;
    while let Some(start) = rest.find('%') {
        result.push_str(&rest[..start]);
        let after = &rest[start + 1..];
        match after.find('%') {
            Some(end) if end > 0 => {
                let name = &after[..end];
                match std::env::var(name) {
                    Ok(value) => result.push_str(&value),
                    Err(_) => {
                        // Leave unknown variables untouched so the error message
                        // shows exactly what the user typed.
                        result.push('%');
                        result.push_str(name);
                        result.push('%');
                    }
                }
                rest = &after[end + 1..];
            }
            _ => {
                result.push('%');
                rest = after;
            }
        }
    }
    result.push_str(rest);
    result
}

pub fn cache_key(path: &str) -> String {
    format!("space:{}", path.trim().replace('/', "\\").to_lowercase())
}

/// Scans `raw_path` and returns a bounded report.
///
/// `progress` is called from worker threads at most a few times per second.
/// It must be thread-safe; the Tauri command uses it to emit UI events.
pub fn analyze(
    raw_path: &str,
    progress: Option<&(dyn Fn(SpaceScanProgress) + Sync)>,
) -> Result<SpaceReport, String> {
    let started = Instant::now();
    let root = resolve_path(raw_path)?;
    let root_display = display_path(&root);

    let root_entries = std::fs::read_dir(&root)
        .map_err(|error| format!("Could not read '{}': {}", root_display, error))?;

    let mut root_stats = WorkerStats::new();
    let mut child_dirs: Vec<(String, PathBuf)> = Vec::new();
    let mut child_seen: HashSet<PathBuf> = HashSet::new();

    for entry in root_entries.flatten() {
        let path = entry.path();
        let file_type = match entry.file_type() {
            Ok(kind) => kind,
            Err(_) => {
                root_stats.inaccessible += 1;
                continue;
            }
        };
        if file_type.is_symlink() {
            continue;
        }

        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(_) => {
                root_stats.inaccessible += 1;
                continue;
            }
        };
        if is_reparse_point(&metadata) {
            continue;
        }

        if file_type.is_dir() {
            let name = path
                .file_name()
                .map(|value| value.to_string_lossy().to_string())
                .unwrap_or_else(|| display_path(&path));
            if child_seen.insert(path.clone()) {
                root_stats.folders += 1;
                child_dirs.push((name, path));
            }
        } else if file_type.is_file() {
            let size = metadata.len();
            root_stats.record_file(&path, size, 0);
        }
    }

    // Bucket 0 is reserved for files sitting directly in the scanned folder;
    // child folders use buckets 1..=child_dirs.len().
    let mut queue = VecDeque::new();
    for (index, (_, path)) in child_dirs.iter().enumerate() {
        queue.push_back(Job {
            path: path.clone(),
            bucket: index + 1,
        });
    }
    let initial_jobs = queue.len();

    let shared = Shared {
        queue: Mutex::new(queue),
        cv: Condvar::new(),
        pending: AtomicUsize::new(initial_jobs),
        stop: AtomicBool::new(false),
        total_bytes: AtomicU64::new(0),
        total_files: AtomicU64::new(0),
        total_folders: AtomicU64::new(0),
        entries: AtomicU64::new(0),
        last_progress_ms: AtomicU64::new(0),
        started,
    };

    let worker_count = if initial_jobs == 0 {
        0
    } else {
        std::thread::available_parallelism()
            .map(|value| value.get())
            .unwrap_or(4)
            .clamp(1, WORKER_LIMIT)
            .min(initial_jobs)
    };

    let mut worker_results: Vec<WorkerStats> = Vec::new();
    if worker_count > 0 {
        std::thread::scope(|scope| {
            let handles: Vec<_> = (0..worker_count)
                .map(|_| {
                    scope.spawn(|| {
                        let mut stats = WorkerStats::new();
                        run_worker(&shared, &mut stats, progress, &root_display);
                        stats
                    })
                })
                .collect();

            for handle in handles {
                match handle.join() {
                    Ok(stats) => worker_results.push(stats),
                    Err(_) => {
                        // A panicking worker only loses that subtree's numbers.
                        // The rest of the scan is still useful.
                    }
                }
            }
        });
    }

    let mut merged = WorkerStats::new();
    merged.merge(&root_stats);
    for stats in worker_results {
        merged.merge(&stats);
    }

    let truncated = shared.stop.load(AtomicOrdering::Relaxed);
    let stats = finalize(
        &root_display,
        &child_dirs,
        merged,
        truncated,
        started.elapsed(),
    );

    if let Some(callback) = progress {
        callback(SpaceScanProgress {
            root: root_display,
            scanned_bytes: stats.total_bytes,
            file_count: stats.file_count,
            folder_count: stats.folder_count,
            current_path: stats.root.clone(),
            elapsed_ms: started.elapsed().as_millis() as u64,
        });
    }

    Ok(stats)
}

fn finalize(
    root_display: &str,
    child_dirs: &[(String, PathBuf)],
    merged: WorkerStats,
    truncated: bool,
    elapsed: Duration,
) -> SpaceReport {
    let mut folders: Vec<SpaceEntry> = child_dirs
        .iter()
        .enumerate()
        .filter_map(|(index, (name, path))| {
            let size = merged.bucket_bytes.get(index + 1).copied().unwrap_or(0);
            let files = merged.bucket_files.get(index + 1).copied().unwrap_or(0);
            if size == 0 {
                return None;
            }
            Some(SpaceEntry {
                name: name.clone(),
                path: display_path(path),
                size_bytes: size,
                file_count: files,
                is_dir: true,
            })
        })
        .collect();

    let root_files_size = merged.bucket_bytes.first().copied().unwrap_or(0);
    let root_files_count = merged.bucket_files.first().copied().unwrap_or(0);
    if root_files_size > 0 {
        folders.push(SpaceEntry {
            name: "(files directly in this folder)".to_string(),
            path: root_display.to_string(),
            size_bytes: root_files_size,
            file_count: root_files_count,
            is_dir: false,
        });
    }

    folders.sort_by(|left, right| right.size_bytes.cmp(&left.size_bytes));
    folders.truncate(TOP_FOLDERS_LIMIT);

    let mut top_files: Vec<SpaceEntry> = merged
        .top_files
        .into_iter()
        .map(|entry| SpaceEntry {
            name: entry
                .0
                .path
                .file_name()
                .map(|value| value.to_string_lossy().to_string())
                .unwrap_or_else(|| entry.0.path.to_string_lossy().to_string()),
            path: display_path(&entry.0.path),
            size_bytes: entry.0.size,
            file_count: 1,
            is_dir: false,
        })
        .collect();
    top_files.sort_by(|left, right| right.size_bytes.cmp(&left.size_bytes));
    top_files.truncate(TOP_FILES_LIMIT);

    let mut categories: Vec<SpaceCategory> = merged
        .categories
        .into_iter()
        .map(|(name, (size_bytes, file_count))| SpaceCategory {
            name: name.to_string(),
            size_bytes,
            file_count,
        })
        .collect();
    categories.sort_by(|left, right| right.size_bytes.cmp(&left.size_bytes));
    categories.truncate(12);

    let total_bytes = merged.total_bytes;
    let file_count = merged.total_files;
    let folder_count = merged.folders;
    let inaccessible = merged.inaccessible;

    SpaceReport {
        root: root_display.to_string(),
        scanned_at: chrono::Local::now().to_rfc3339(),
        duration_ms: elapsed.as_millis() as u64,
        total_bytes,
        file_count,
        folder_count,
        inaccessible,
        truncated,
        top_folders: folders,
        top_files,
        categories,
    }
}

struct Job {
    path: PathBuf,
    bucket: usize,
}

struct Shared {
    queue: Mutex<VecDeque<Job>>,
    cv: Condvar,
    pending: AtomicUsize,
    stop: AtomicBool,
    total_bytes: AtomicU64,
    total_files: AtomicU64,
    total_folders: AtomicU64,
    entries: AtomicU64,
    last_progress_ms: AtomicU64,
    started: Instant,
}

struct WorkerStats {
    bucket_bytes: Vec<u64>,
    bucket_files: Vec<u64>,
    total_bytes: u64,
    total_files: u64,
    folders: u64,
    inaccessible: u64,
    top_files: BinaryHeap<std::cmp::Reverse<FileCandidate>>,
    categories: HashMap<&'static str, (u64, u64)>,
}

#[derive(Debug, Eq, PartialEq, Clone)]
struct FileCandidate {
    size: u64,
    path: PathBuf,
}

impl Ord for FileCandidate {
    fn cmp(&self, other: &Self) -> Ordering {
        self.size
            .cmp(&other.size)
            .then_with(|| self.path.cmp(&other.path))
    }
}

impl PartialOrd for FileCandidate {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl WorkerStats {
    fn new() -> Self {
        Self {
            bucket_bytes: Vec::new(),
            bucket_files: Vec::new(),
            total_bytes: 0,
            total_files: 0,
            folders: 0,
            inaccessible: 0,
            top_files: BinaryHeap::new(),
            categories: HashMap::new(),
        }
    }

    fn record_file(&mut self, path: &Path, size: u64, bucket: usize) {
        self.total_bytes = self.total_bytes.saturating_add(size);
        self.total_files += 1;

        if self.bucket_bytes.len() <= bucket {
            self.bucket_bytes.resize(bucket + 1, 0);
            self.bucket_files.resize(bucket + 1, 0);
        }
        self.bucket_bytes[bucket] = self.bucket_bytes[bucket].saturating_add(size);
        self.bucket_files[bucket] += 1;

        let category = category_for(path);
        let slot = self.categories.entry(category).or_insert((0, 0));
        slot.0 = slot.0.saturating_add(size);
        slot.1 += 1;

        let candidate = FileCandidate {
            size,
            path: path.to_path_buf(),
        };
        if self.top_files.len() < TOP_FILES_LIMIT {
            self.top_files.push(std::cmp::Reverse(candidate));
        } else if let Some(std::cmp::Reverse(smallest)) = self.top_files.peek() {
            if size > smallest.size {
                self.top_files.pop();
                self.top_files.push(std::cmp::Reverse(candidate));
            }
        }
    }

    fn merge(&mut self, other: &WorkerStats) {
        self.total_bytes = self.total_bytes.saturating_add(other.total_bytes);
        self.total_files += other.total_files;
        self.folders += other.folders;
        self.inaccessible += other.inaccessible;

        if self.bucket_bytes.len() < other.bucket_bytes.len() {
            self.bucket_bytes.resize(other.bucket_bytes.len(), 0);
            self.bucket_files.resize(other.bucket_files.len(), 0);
        }
        for (index, size) in other.bucket_bytes.iter().enumerate() {
            self.bucket_bytes[index] = self.bucket_bytes[index].saturating_add(*size);
            self.bucket_files[index] += other.bucket_files.get(index).copied().unwrap_or(0);
        }

        for (category, (size, files)) in &other.categories {
            let slot = self.categories.entry(category).or_insert((0, 0));
            slot.0 = slot.0.saturating_add(*size);
            slot.1 += files;
        }

        for candidate in other.top_files.iter() {
            if self.top_files.len() < TOP_FILES_LIMIT {
                self.top_files.push(std::cmp::Reverse(candidate.0.clone()));
            } else if let Some(std::cmp::Reverse(smallest)) = self.top_files.peek() {
                if candidate.0.size > smallest.size {
                    self.top_files.pop();
                    self.top_files.push(std::cmp::Reverse(candidate.0.clone()));
                }
            }
        }
    }
}

fn run_worker(
    shared: &Shared,
    stats: &mut WorkerStats,
    progress: Option<&(dyn Fn(SpaceScanProgress) + Sync)>,
    root_display: &str,
) {
    loop {
        let job = {
            let mut queue = shared
                .queue
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            loop {
                if shared.stop.load(AtomicOrdering::Relaxed) && queue.is_empty() {
                    return;
                }
                if let Some(job) = queue.pop_front() {
                    break job;
                }
                if shared.pending.load(AtomicOrdering::Relaxed) == 0 {
                    return;
                }
                queue = shared
                    .cv
                    .wait(queue)
                    .unwrap_or_else(|poisoned| poisoned.into_inner());
            }
        };

        scan_directory(&job, shared, stats, progress, root_display);

        shared.pending.fetch_sub(1, AtomicOrdering::AcqRel);
        shared.cv.notify_all();
    }
}

fn scan_directory(
    job: &Job,
    shared: &Shared,
    stats: &mut WorkerStats,
    progress: Option<&(dyn Fn(SpaceScanProgress) + Sync)>,
    root_display: &str,
) {
    if shared.stop.load(AtomicOrdering::Relaxed) {
        return;
    }

    let entries = match std::fs::read_dir(&job.path) {
        Ok(entries) => entries,
        Err(_) => {
            stats.inaccessible += 1;
            return;
        }
    };

    for entry in entries.flatten() {
        if shared.stop.load(AtomicOrdering::Relaxed) {
            return;
        }

        let total_entries = shared.entries.fetch_add(1, AtomicOrdering::Relaxed) + 1;
        // Reading the clock on every file is measurably expensive across
        // hundreds of thousands of entries; 256-entry batches are fine for a
        // 20-second budget.
        if total_entries > MAX_ENTRIES
            || (total_entries % 256 == 0 && shared.started.elapsed() > MAX_DURATION)
        {
            shared.stop.store(true, AtomicOrdering::Relaxed);
            let mut queue = shared
                .queue
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            queue.clear();
            shared.cv.notify_all();
            return;
        }

        if total_entries % 64 == 0 {
            if let Some(callback) = progress {
                maybe_report_progress(shared, callback, root_display, &job.path);
            }
        }

        let path = entry.path();
        let file_type = match entry.file_type() {
            Ok(kind) => kind,
            Err(_) => {
                stats.inaccessible += 1;
                continue;
            }
        };
        if file_type.is_symlink() {
            continue;
        }

        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(_) => {
                stats.inaccessible += 1;
                continue;
            }
        };
        if is_reparse_point(&metadata) {
            continue;
        }

        if file_type.is_dir() {
            stats.folders += 1;
            shared.total_folders.fetch_add(1, AtomicOrdering::Relaxed);
            let mut queue = shared
                .queue
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            queue.push_back(Job {
                path,
                bucket: job.bucket,
            });
            shared.pending.fetch_add(1, AtomicOrdering::AcqRel);
            drop(queue);
            shared.cv.notify_one();
        } else if file_type.is_file() {
            let size = metadata.len();
            stats.record_file(&path, size, job.bucket);
            shared.total_bytes.fetch_add(size, AtomicOrdering::Relaxed);
            shared.total_files.fetch_add(1, AtomicOrdering::Relaxed);
        }
    }
}

fn maybe_report_progress(
    shared: &Shared,
    callback: &(dyn Fn(SpaceScanProgress) + Sync),
    root_display: &str,
    current_path: &Path,
) {
    let elapsed_ms = shared.started.elapsed().as_millis() as u64;
    let last = shared.last_progress_ms.load(AtomicOrdering::Relaxed);
    if elapsed_ms.saturating_sub(last) < 400 {
        return;
    }
    if shared
        .last_progress_ms
        .compare_exchange(
            last,
            elapsed_ms,
            AtomicOrdering::Relaxed,
            AtomicOrdering::Relaxed,
        )
        .is_err()
    {
        return;
    }

    callback(SpaceScanProgress {
        root: root_display.to_string(),
        scanned_bytes: shared.total_bytes.load(AtomicOrdering::Relaxed),
        file_count: shared.total_files.load(AtomicOrdering::Relaxed),
        folder_count: shared.total_folders.load(AtomicOrdering::Relaxed),
        current_path: display_path(current_path),
        elapsed_ms,
    });
}

fn is_reparse_point(metadata: &std::fs::Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
            return true;
        }
    }
    let _ = metadata;
    false
}

/// Groups files for the "what is using my disk" summary.
fn category_for(path: &Path) -> &'static str {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    match extension.as_str() {
        "png" | "jpg" | "jpeg" | "gif" | "bmp" | "webp" | "svg" | "ico" | "heic" | "raw"
        | "tif" | "tiff" => "Images",
        "mp4" | "mkv" | "mov" | "avi" | "wmv" | "webm" | "m4v" | "flv" => "Video",
        "mp3" | "wav" | "flac" | "m4a" | "ogg" | "aac" | "wma" => "Audio",
        "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "txt" | "md" | "rtf" | "odt"
        | "csv" | "epub" => "Documents",
        "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "xz" | "iso" | "cab" | "msi" => "Archives",
        "exe" | "dll" | "sys" | "msix" | "appx" | "cab5" | "com" => "Programs",
        "tmp" | "log" | "dmp" | "cache" | "etl" | "evtx" | "old" => "Temporary & logs",
        "db" | "sqlite" | "sqlite3" | "mdb" | "accdb" | "dat" | "edb" => "Databases",
        "js" | "ts" | "tsx" | "jsx" | "rs" | "py" | "java" | "c" | "cpp" | "h" | "hpp" | "cs"
        | "go" | "rb" | "php" | "html" | "css" | "scss" | "json" | "xml" | "yml" | "yaml" => {
            "Code & data"
        }
        _ => "Other",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;

    fn write_file(root: &Path, relative: &str, bytes: usize) {
        let path = root.join(relative);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        let mut file = fs::File::create(path).unwrap();
        file.write_all(&vec![b'x'; bytes]).unwrap();
    }

    #[test]
    fn expands_environment_variables() {
        std::env::set_var("SYNTAX_SPACE_TEST_VAR", "C:\\Example");
        assert_eq!(
            expand_environment("%SYNTAX_SPACE_TEST_VAR%\\Folder"),
            "C:\\Example\\Folder"
        );
        assert_eq!(
            expand_environment("%NOT_SET_ANYWHERE_%"),
            "%NOT_SET_ANYWHERE_%"
        );
        assert_eq!(expand_environment("no variables"), "no variables");
    }

    #[test]
    fn groups_extensions_into_readable_categories() {
        assert_eq!(category_for(Path::new("photo.JPG")), "Images");
        assert_eq!(category_for(Path::new("movie.mkv")), "Video");
        assert_eq!(category_for(Path::new("setup.exe")), "Programs");
        assert_eq!(category_for(Path::new("notes.unknown")), "Other");
    }

    #[test]
    fn reports_progress_when_a_callback_is_supplied() {
        let root =
            std::env::temp_dir().join(format!("syntax-space-progress-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(root.join("data")).unwrap();
        write_file(&root, "data/file.bin", 1024);

        let updates = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
        let sink = updates.clone();
        let callback = move |progress: SpaceScanProgress| {
            sink.lock().unwrap().push(progress);
        };

        let report = analyze(root.to_str().unwrap(), Some(&callback)).unwrap();
        let captured = updates.lock().unwrap();
        assert!(!captured.is_empty());
        let last = captured.last().unwrap();
        assert_eq!(last.scanned_bytes, report.total_bytes);
        assert_eq!(last.file_count, report.file_count);

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn scans_a_small_tree_without_following_links() {
        let root = std::env::temp_dir().join(format!("syntax-space-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(root.join("alpha/nested")).unwrap();
        fs::create_dir_all(root.join("beta")).unwrap();
        write_file(&root, "top.dat", 300);
        write_file(&root, "alpha/one.bin", 1000);
        write_file(&root, "alpha/nested/two.bin", 2000);
        write_file(&root, "beta/three.txt", 500);

        let report = analyze(root.to_str().unwrap(), None).unwrap();
        assert_eq!(report.total_bytes, 3800);
        assert_eq!(report.file_count, 4);
        assert_eq!(report.folder_count, 3);
        assert!(!report.truncated);

        let alpha = report
            .top_folders
            .iter()
            .find(|entry| entry.name == "alpha")
            .unwrap();
        assert_eq!(alpha.size_bytes, 3000);
        let beta = report
            .top_folders
            .iter()
            .find(|entry| entry.name == "beta")
            .unwrap();
        assert_eq!(beta.size_bytes, 500);

        assert!(report
            .top_files
            .iter()
            .any(|entry| entry.name == "two.bin" && entry.size_bytes == 2000));

        let _ = fs::remove_dir_all(&root);
    }
}
