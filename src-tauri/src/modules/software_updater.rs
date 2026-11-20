//! Microsoft WinGet update engine.
//!
//! The old implementation had three reliability problems that made updates
//! look broken:
//!
//! 1. It matched packages by a substring id, so WinGet could pick the wrong
//!    package or refuse an ambiguous match. Upgrades now use `--exact` and the
//!    source that produced the update.
//! 2. It passed `--silent` and then waited only ten minutes. A Visual Studio
//!    update legitimately needs longer than that, so WinGet was killed halfway
//!    through and the UI reported a failure. Upgrades now have a one-hour
//!    budget and stream milestones while they run.
//! 3. It treated every non-zero exit code as the same opaque string. WinGet has
//!    well-defined HRESULTs for "already current", "another install is
//!    running", "file in use", "reboot required", and so on; those are now
//!    classified into messages a person can act on.
//!
//! The engine is intentionally conservative: it never forces an install, never
//! ignores installer hashes, and never reboots the machine on its own.

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;
use std::time::Duration;

use crate::log_line;
use crate::modules::{cache, system_info, winproc};

const LIST_TTL: Duration = Duration::from_secs(60);
const LIST_TIMEOUT: Duration = Duration::from_secs(120);
const UPGRADE_TIMEOUT: Duration = Duration::from_secs(60 * 60);
const MAX_LOG_LINES: usize = 80;

const WINGET_MISSING: &str = "Windows Package Manager (WinGet) is not available. Install or update 'App Installer' from the Microsoft Store, then try again.";

static UPDATE_BUSY: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoftwareUpdate {
    pub id: String,
    pub name: String,
    pub current_version: String,
    pub available_version: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateScan {
    pub engine_version: String,
    pub is_admin: bool,
    pub updates: Vec<SoftwareUpdate>,
    pub warnings: Vec<String>,
    pub scanned_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProgress {
    pub id: String,
    pub name: String,
    pub status: String,
    pub message: String,
    pub detail: String,
    pub index: usize,
    pub total: usize,
    pub requires_reboot: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateOutcome {
    pub id: String,
    pub name: String,
    pub status: String,
    pub message: String,
    pub new_version: String,
    pub logs: Vec<String>,
    pub requires_reboot: bool,
    pub interactive_retry: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSummary {
    pub succeeded: usize,
    pub failed: usize,
    pub already_current: usize,
    pub skipped: usize,
    pub reboot_required: bool,
    pub outcomes: Vec<UpdateOutcome>,
}

pub type ProgressSink<'a> = &'a (dyn Fn(UpdateProgress) + Sync);

struct BusyGuard;

impl BusyGuard {
    fn acquire() -> Result<Self, String> {
        if UPDATE_BUSY.swap(true, Ordering::SeqCst) {
            return Err(
                "Another update is already running. Wait for it to finish, then try again.".into(),
            );
        }
        Ok(Self)
    }
}

impl Drop for BusyGuard {
    fn drop(&mut self) {
        UPDATE_BUSY.store(false, Ordering::SeqCst);
    }
}

/// Lists packages with a pending upgrade.
///
/// Unlike the old implementation this returns an error when WinGet itself is
/// unavailable. Silently returning an empty list made the UI claim the PC was
/// fully up to date even when the engine had never run.
pub fn check_software_updates(force: bool) -> Result<UpdateScan, String> {
    let cache_key = "updates:scan";
    if !force {
        if let Some(scan) = cache::get::<UpdateScan>(cache_key, LIST_TTL) {
            return Ok(scan);
        }
    }

    let engine_version = winget_version()?;
    let output = run_winget(
        &[
            "upgrade".to_string(),
            "--include-unknown".to_string(),
            "--accept-source-agreements".to_string(),
            "--disable-interactivity".to_string(),
        ],
        LIST_TIMEOUT,
        |_| {},
    )
    .map_err(|error| friendly_runner_error(&error))?;

    let text = joined_output(&output);
    let updates = if output.status.success() {
        parse_winget_table(&text)
    } else {
        let code = output.status.code().map(|value| value as u32);
        if matches!(code, Some(0x8A15_0014) | Some(0x8A15_002B)) || is_no_updates_text(&text) {
            Vec::new()
        } else if matches!(code, Some(0x8A15_0015)) {
            return Err(
                "WinGet has no package sources configured. Reset WinGet with 'winget source reset --force' and try again."
                    .into(),
            );
        } else {
            return Err(format!(
                "WinGet could not check for updates: {}",
                summarize_output(&text)
            ));
        }
    };

    let mut warnings = Vec::new();
    if text.to_ascii_lowercase().contains("msstore") {
        warnings.push(
            "Microsoft Store packages are included. Sign in to the Store if one of them fails."
                .to_string(),
        );
    }

    let scan = UpdateScan {
        engine_version,
        is_admin: system_info::is_elevated(),
        updates,
        warnings,
        scanned_at: chrono::Local::now().to_rfc3339(),
    };

    cache::put(cache_key, &scan);
    Ok(scan)
}

/// Upgrades one package.
///
/// `interactive` deliberately omits `--silent` and `--disable-interactivity` so
/// a stubborn installer can show its own window. It is only used when the user
/// clicks "Retry with installer UI".
pub fn upgrade_software(
    update: &SoftwareUpdate,
    interactive: bool,
    index: usize,
    total: usize,
    progress: Option<ProgressSink<'_>>,
) -> Result<UpdateOutcome, String> {
    let _guard = BusyGuard::acquire()?;
    let outcome = upgrade_one(update, interactive, index, total, progress);
    cache::invalidate("updates:");
    record_outcome(&outcome);
    Ok(outcome)
}

/// Upgrades a queue of packages in order.
///
/// WinGet serialises installs with a global mutex, so running them in parallel
/// would only produce "another installation is in progress" errors. Running
/// them sequentially also lets a reboot-required result stop the queue cleanly.
pub fn upgrade_all_software(
    updates: &[SoftwareUpdate],
    progress: Option<ProgressSink<'_>>,
) -> Result<UpdateSummary, String> {
    let _guard = BusyGuard::acquire()?;
    if updates.is_empty() {
        return Ok(UpdateSummary {
            succeeded: 0,
            failed: 0,
            already_current: 0,
            skipped: 0,
            reboot_required: false,
            outcomes: Vec::new(),
        });
    }

    let total = updates.len();
    for (offset, update) in updates.iter().enumerate() {
        emit(
            progress,
            update,
            "queued",
            "Queued",
            "",
            offset + 1,
            total,
            false,
        );
    }

    let mut outcomes = Vec::with_capacity(total);
    for (offset, update) in updates.iter().enumerate() {
        let outcome = upgrade_one(update, false, offset + 1, total, progress);
        let reboot_required = outcome.requires_reboot;
        record_outcome(&outcome);
        outcomes.push(outcome);

        if reboot_required {
            for (remaining, skipped) in updates.iter().enumerate().skip(offset + 1) {
                emit(
                    progress,
                    skipped,
                    "skipped",
                    "Restart required before continuing",
                    "",
                    remaining + 1,
                    total,
                    false,
                );
                outcomes.push(UpdateOutcome::skipped(
                    skipped,
                    "Restart Windows to finish the previous update, then resume the queue.",
                ));
            }
            break;
        }
    }

    cache::invalidate("updates:");
    Ok(summarize(outcomes))
}

fn upgrade_one(
    update: &SoftwareUpdate,
    interactive: bool,
    index: usize,
    total: usize,
    progress: Option<ProgressSink<'_>>,
) -> UpdateOutcome {
    emit(
        progress,
        update,
        "running",
        if interactive {
            "Starting update with installer UI…"
        } else {
            "Starting update…"
        },
        "",
        index,
        total,
        false,
    );

    let mut attempt = 0usize;
    let mut all_logs: Vec<String> = Vec::new();

    loop {
        attempt += 1;
        let args = upgrade_arguments(update, interactive);
        let mut attempt_logs: Vec<String> = Vec::new();
        let mut requires_reboot = false;

        let result = {
            let sink = progress;
            run_winget(&args, UPGRADE_TIMEOUT, |line| {
                let line = strip_ansi(line);
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    return;
                }

                push_log(&mut attempt_logs, trimmed);
                if let Some(message) = milestone(trimmed) {
                    if message.contains("Restart") {
                        requires_reboot = true;
                    }
                    emit(
                        sink, update, "running", &message, trimmed, index, total, false,
                    );
                }
            })
        };

        for line in attempt_logs {
            push_log(&mut all_logs, &line);
        }

        let output = match result {
            Ok(output) => output,
            Err(error) => {
                return UpdateOutcome::failed(
                    update,
                    friendly_runner_error(&error),
                    all_logs,
                    false,
                );
            }
        };

        if output.status.success() {
            if !requires_reboot {
                requires_reboot = output_mentions_reboot(&joined_output(&output));
            }
            let message = if requires_reboot {
                "Updated. Restart Windows to finish applying the update."
            } else {
                "Updated successfully."
            };
            emit(
                progress,
                update,
                "succeeded",
                message,
                "",
                index,
                total,
                requires_reboot,
            );
            return UpdateOutcome {
                id: update.id.clone(),
                name: update.name.clone(),
                status: "succeeded".to_string(),
                message: message.to_string(),
                new_version: update.available_version.clone(),
                logs: all_logs,
                requires_reboot,
                interactive_retry: false,
            };
        }

        let text = joined_output(&output);
        let code = output.status.code().map(|value| value as u32);
        let failure = classify_failure(update, code, &text);

        match failure.kind {
            FailureKind::AlreadyCurrent => {
                emit(
                    progress,
                    update,
                    "already-current",
                    &failure.message,
                    "",
                    index,
                    total,
                    false,
                );
                return UpdateOutcome::already_current(update, all_logs);
            }
            FailureKind::Skipped => {
                emit(
                    progress,
                    update,
                    "skipped",
                    &failure.message,
                    "",
                    index,
                    total,
                    false,
                );
                return UpdateOutcome::skipped(update, &failure.message);
            }
            FailureKind::Reboot => {
                emit(
                    progress,
                    update,
                    "succeeded",
                    &failure.message,
                    "",
                    index,
                    total,
                    true,
                );
                return UpdateOutcome {
                    id: update.id.clone(),
                    name: update.name.clone(),
                    status: "succeeded".to_string(),
                    message: failure.message,
                    new_version: update.available_version.clone(),
                    logs: all_logs,
                    requires_reboot: true,
                    interactive_retry: false,
                };
            }
            _ => {
                if let Some(delay) = failure.retry_after {
                    if attempt < failure.max_attempts {
                        emit(
                            progress,
                            update,
                            "running",
                            &format!("{} Retrying in {}s…", failure.message, delay.as_secs()),
                            "",
                            index,
                            total,
                            false,
                        );
                        std::thread::sleep(delay);
                        continue;
                    }
                }

                emit(
                    progress,
                    update,
                    "failed",
                    &failure.message,
                    "",
                    index,
                    total,
                    false,
                );
                return UpdateOutcome::failed(
                    update,
                    failure.message,
                    all_logs,
                    failure.interactive_retry,
                );
            }
        }
    }
}

fn upgrade_arguments(update: &SoftwareUpdate, interactive: bool) -> Vec<String> {
    let mut args = vec![
        "upgrade".to_string(),
        "--id".to_string(),
        update.id.clone(),
        "--exact".to_string(),
        "--include-unknown".to_string(),
        "--accept-source-agreements".to_string(),
        "--accept-package-agreements".to_string(),
    ];

    let source = update.source.trim();
    if !source.is_empty() && !source.eq_ignore_ascii_case("unknown") {
        args.push("--source".to_string());
        args.push(source.to_string());
    }

    if interactive {
        // Let WinGet and the installer ask their own questions. This is the
        // escape hatch for packages whose silent switches are broken.
    } else {
        args.push("--silent".to_string());
        args.push("--disable-interactivity".to_string());
    }

    args
}

fn run_winget<F>(
    args: &[String],
    timeout: Duration,
    on_line: F,
) -> Result<std::process::Output, String>
where
    F: FnMut(&str),
{
    let mut cmd = winproc::hidden(&winget_program());
    cmd.args(args);
    winproc::run_streaming_with_timeout(cmd, timeout, on_line)
}

fn winget_program() -> String {
    static PROGRAM: OnceLock<String> = OnceLock::new();
    PROGRAM
        .get_or_init(|| {
            let mut probe = winproc::hidden("winget");
            probe.arg("--version");
            if winproc::run_with_timeout(probe, Duration::from_secs(15))
                .map(|output| output.status.success())
                .unwrap_or(false)
            {
                return "winget".to_string();
            }

            // GUI processes do not always inherit the App Execution Alias
            // folder the same way a terminal does. Resolve the alias directly.
            if let Ok(local) = std::env::var("LOCALAPPDATA") {
                let alias = Path::new(&local)
                    .join("Microsoft")
                    .join("WindowsApps")
                    .join("winget.exe");
                if alias.is_file() {
                    return alias.to_string_lossy().to_string();
                }
            }

            "winget".to_string()
        })
        .clone()
}

fn winget_version() -> Result<String, String> {
    let mut cmd = winproc::hidden(&winget_program());
    cmd.arg("--version");
    let output = winproc::run_with_timeout(cmd, Duration::from_secs(20))
        .map_err(|_| WINGET_MISSING.to_string())?;

    if !output.status.success() {
        return Err(WINGET_MISSING.to_string());
    }

    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if version.is_empty() {
        return Err(WINGET_MISSING.to_string());
    }
    Ok(version)
}

/// Parses the fixed-width `winget upgrade` table.
///
/// Be lenient about the optional Source column: older WinGet builds and some
/// custom sources leave it blank. Everything is aligned from the right because
/// the package name is the only field that contains spaces.
pub(crate) fn parse_winget_table(text: &str) -> Vec<SoftwareUpdate> {
    let text = strip_ansi(text);
    let mut updates = Vec::new();
    let mut seen = HashSet::new();
    let mut header_passed = false;

    for raw in text.lines() {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            continue;
        }

        if !header_passed {
            if trimmed.starts_with("---") {
                header_passed = true;
            }
            continue;
        }

        let lower = trimmed.to_ascii_lowercase();
        if lower.contains("no installed package found")
            || lower.contains("no available upgrade")
            || lower.contains("no newer package versions")
            || lower.contains("no applicable upgrade")
            || lower.contains("upgrades available")
            || lower.contains("upgrade available")
            || lower.starts_with("failed")
            || lower.starts_with("error")
        {
            continue;
        }

        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.len() < 4 {
            continue;
        }

        let last = parts[parts.len() - 1];
        let second_last = parts[parts.len() - 2];
        let has_source =
            is_known_source(last) || (!looks_like_version(last) && looks_like_version(second_last));
        let source_tokens = usize::from(has_source);
        let name_end = parts.len().saturating_sub(3 + source_tokens);
        if name_end == 0 {
            continue;
        }

        let available_version = parts[parts.len() - 1 - source_tokens].to_string();
        let current_version = parts[parts.len() - 2 - source_tokens].to_string();
        let id = parts[parts.len() - 3 - source_tokens].to_string();
        let name = parts[..name_end].join(" ");
        let source = if has_source {
            last.to_string()
        } else {
            String::new()
        };

        if id.is_empty() || name.is_empty() {
            continue;
        }
        if !id.chars().any(|ch| ch.is_ascii_alphanumeric()) {
            continue;
        }
        if !seen.insert((id.clone(), source.to_ascii_lowercase())) {
            continue;
        }

        updates.push(SoftwareUpdate {
            id,
            name,
            current_version,
            available_version,
            source,
        });
    }

    updates.sort_by(|left, right| {
        left.name
            .to_ascii_lowercase()
            .cmp(&right.name.to_ascii_lowercase())
    });
    updates
}

fn is_known_source(token: &str) -> bool {
    token.eq_ignore_ascii_case("winget") || token.eq_ignore_ascii_case("msstore")
}

fn looks_like_version(token: &str) -> bool {
    token.eq_ignore_ascii_case("unknown")
        || token
            .chars()
            .next()
            .map(|ch| ch.is_ascii_digit())
            .unwrap_or(false)
}

fn is_no_updates_text(text: &str) -> bool {
    let lower = text.to_ascii_lowercase();
    lower.contains("no installed package found")
        || lower.contains("no available upgrade")
        || lower.contains("no newer package versions")
        || lower.contains("no applicable upgrade")
        || lower.contains("upgrades available")
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum FailureKind {
    AlreadyCurrent,
    Skipped,
    Reboot,
    Busy,
    Network,
    Elevation,
    InUse,
    Policy,
    Pinned,
    TechnologyMismatch,
    DiskFull,
    HashMismatch,
    Cancelled,
    Installer,
    Unknown,
}

struct Failure {
    kind: FailureKind,
    message: String,
    retry_after: Option<Duration>,
    max_attempts: usize,
    interactive_retry: bool,
}

fn classify_failure(update: &SoftwareUpdate, code: Option<u32>, text: &str) -> Failure {
    let lower = text.to_ascii_lowercase();
    let code = code
        .filter(|value| *value != 0)
        .or_else(|| extract_code(text));
    let installer_failure = text_mentions_installer_failure(&lower);

    let failure = |kind, message: String, retry_after, max_attempts, interactive_retry| Failure {
        kind,
        message,
        retry_after,
        max_attempts,
        interactive_retry,
    };

    if let Some(code) = code {
        match code {
            0x8A15_002B | 0x8A15_004F | 0x8A15_0050 | 0x8A15_0061 | 0x8A15_010D => {
                return failure(
                    FailureKind::AlreadyCurrent,
                    "Already up to date.".to_string(),
                    None,
                    1,
                    false,
                );
            }
            0x8A15_0014 => {
                return failure(
                    FailureKind::Skipped,
                    "This package is no longer installed.".to_string(),
                    None,
                    1,
                    false,
                );
            }
            0x8A15_0109 | 0x8A15_010A | 0x8A15_010B => {
                return failure(
                    FailureKind::Reboot,
                    "Update installed. Restart Windows to finish.".to_string(),
                    None,
                    1,
                    false,
                );
            }
            0x8A15_0102 => {
                return failure(
                    FailureKind::Busy,
                    "Another installation is in progress.".to_string(),
                    Some(Duration::from_secs(8)),
                    3,
                    false,
                );
            }
            0x8A15_0107 | 0x8A15_0008 | 0x8A15_0040 => {
                return failure(
                    FailureKind::Network,
                    "The download failed. Check your internet connection and retry.".to_string(),
                    Some(Duration::from_secs(4)),
                    2,
                    false,
                );
            }
            0x8A15_0019 | 0x8A15_0009 => {
                return failure(
                    FailureKind::Elevation,
                    "Administrator approval is required. Approve the Windows prompt, or restart Syntax Uninstaller as administrator and retry."
                        .to_string(),
                    None,
                    1,
                    true,
                );
            }
            0x8A15_0101 | 0x8A15_0103 | 0x8A15_0111 => {
                return failure(
                    FailureKind::InUse,
                    format!(
                        "{} is in use. Close it, then retry the update.",
                        update.name
                    ),
                    None,
                    1,
                    false,
                );
            }
            0x8A15_0105 => {
                return failure(
                    FailureKind::DiskFull,
                    "Not enough free disk space to install this update.".to_string(),
                    None,
                    1,
                    false,
                );
            }
            0x8A15_003A | 0x8A15_010F => {
                return failure(
                    FailureKind::Policy,
                    "Windows or your organization's policy blocked this update.".to_string(),
                    None,
                    1,
                    false,
                );
            }
            0x8A15_0068 => {
                return failure(
                    FailureKind::Pinned,
                    "This package is pinned in WinGet. Unpin it to receive updates.".to_string(),
                    None,
                    1,
                    false,
                );
            }
            0x8A15_008E => {
                return failure(
                    FailureKind::TechnologyMismatch,
                    "This update uses a different installer type. Uninstall the old version, then install the new one."
                        .to_string(),
                    None,
                    1,
                    false,
                );
            }
            0x8A15_0011 => {
                return failure(
                    FailureKind::HashMismatch,
                    "The installer failed WinGet's hash check. Retrying may fix a corrupted download."
                        .to_string(),
                    Some(Duration::from_secs(3)),
                    2,
                    false,
                );
            }
            0x8A15_010C => {
                return failure(
                    FailureKind::Cancelled,
                    "The update was cancelled in the installer.".to_string(),
                    None,
                    1,
                    false,
                );
            }
            0x8A15_0006 | 0x8A15_0049 | 0x8A15_0115 => {
                return failure(
                    FailureKind::Installer,
                    installer_message(&lower, update),
                    None,
                    1,
                    true,
                );
            }
            0x8A15_0056 => {
                return failure(
                    FailureKind::Installer,
                    "This installer refuses to run with administrator rights. Run the update as a standard user."
                        .to_string(),
                    None,
                    1,
                    false,
                );
            }
            _ => {}
        }
    }

    if lower.contains("no available upgrade")
        || lower.contains("no newer package versions")
        || lower.contains("no applicable upgrade")
        || lower.contains("already installed")
        || lower.contains("up to date")
    {
        return failure(
            FailureKind::AlreadyCurrent,
            "Already up to date.".to_string(),
            None,
            1,
            false,
        );
    }
    if lower.contains("no installed package found") {
        return failure(
            FailureKind::Skipped,
            "This package is no longer installed.".to_string(),
            None,
            1,
            false,
        );
    }
    if lower.contains("another installation") || lower.contains("install in progress") {
        return failure(
            FailureKind::Busy,
            "Another installation is in progress.".to_string(),
            Some(Duration::from_secs(8)),
            3,
            false,
        );
    }
    if lower.contains("requires administrator")
        || lower.contains("requires elevation")
        || lower.contains("run as administrator")
    {
        return failure(
            FailureKind::Elevation,
            "Administrator approval is required. Approve the Windows prompt, or restart Syntax Uninstaller as administrator and retry."
                .to_string(),
            None,
            1,
            true,
        );
    }
    if lower.contains("being used by another process")
        || lower.contains("file in use")
        || lower.contains("package in use")
        || lower.contains("0x80070020")
    {
        return failure(
            FailureKind::InUse,
            format!(
                "{} is in use. Close it, then retry the update.",
                update.name
            ),
            None,
            1,
            false,
        );
    }
    if lower.contains("not enough") && lower.contains("space") {
        return failure(
            FailureKind::DiskFull,
            "Not enough free disk space to install this update.".to_string(),
            None,
            1,
            false,
        );
    }
    if lower.contains("blocked by policy") {
        return failure(
            FailureKind::Policy,
            "Windows or your organization's policy blocked this update.".to_string(),
            None,
            1,
            false,
        );
    }
    if lower.contains("pinned") {
        return failure(
            FailureKind::Pinned,
            "This package is pinned in WinGet. Unpin it to receive updates.".to_string(),
            None,
            1,
            false,
        );
    }
    if lower.contains("technology is different") {
        return failure(
            FailureKind::TechnologyMismatch,
            "This update uses a different installer type. Uninstall the old version, then install the new one."
                .to_string(),
            None,
            1,
            false,
        );
    }
    if lower.contains("hash") && (lower.contains("mismatch") || lower.contains("does not match")) {
        return failure(
            FailureKind::HashMismatch,
            "The installer failed WinGet's hash check. Retrying may fix a corrupted download."
                .to_string(),
            Some(Duration::from_secs(3)),
            2,
            false,
        );
    }
    if lower.contains("cancel") && lower.contains("user") {
        return failure(
            FailureKind::Cancelled,
            "The update was cancelled in the installer.".to_string(),
            None,
            1,
            false,
        );
    }
    if lower.contains("network")
        || lower.contains("internet")
        || lower.contains("connection")
        || lower.contains("download failed")
    {
        return failure(
            FailureKind::Network,
            "The download failed. Check your internet connection and retry.".to_string(),
            Some(Duration::from_secs(4)),
            2,
            false,
        );
    }
    if installer_failure {
        return failure(
            FailureKind::Installer,
            installer_message(&lower, update),
            None,
            1,
            true,
        );
    }

    failure(
        FailureKind::Unknown,
        format!("The update failed. {}", summarize_output(text)),
        None,
        1,
        true,
    )
}

fn installer_message(lower: &str, update: &SoftwareUpdate) -> String {
    if let Some(code) = extract_installer_exit_code(lower) {
        format!(
            "The installer for {} failed (exit code {}). Close the app and retry, or use 'Retry with installer UI'.",
            update.name, code
        )
    } else {
        format!(
            "The installer for {} failed. Close the app and retry, or use 'Retry with installer UI'.",
            update.name
        )
    }
}

fn text_mentions_installer_failure(lower: &str) -> bool {
    lower.contains("installer failed")
        || lower.contains("installation abandoned")
        || lower.contains("install failed")
        || lower.contains("failed with exit code")
        || lower.contains("installer error")
}

fn extract_installer_exit_code(lower: &str) -> Option<String> {
    let marker = "exit code";
    let start = lower.find(marker)? + marker.len();
    let rest = lower[start..].trim_start_matches([':', ' ', '=', '0', 'x']);
    let digits: String = rest
        .chars()
        .take_while(|ch| ch.is_ascii_hexdigit())
        .collect();
    if digits.is_empty() {
        None
    } else {
        Some(format!("0x{}", digits.to_uppercase()))
    }
}

fn extract_code(text: &str) -> Option<u32> {
    let lower = text.to_ascii_lowercase();
    let mut search = lower.as_str();
    while let Some(index) = search.find("0x8a15") {
        let candidate = &search[index + 2..];
        let digits: String = candidate
            .chars()
            .take_while(|ch| ch.is_ascii_hexdigit())
            .collect();
        if digits.len() >= 8 {
            if let Ok(value) = u32::from_str_radix(&digits[..8], 16) {
                return Some(value);
            }
        }
        search = &candidate[digits.len().min(candidate.len())..];
    }
    None
}

fn milestone(line: &str) -> Option<String> {
    let lower = line.to_ascii_lowercase();
    let message = if lower.contains("downloading") {
        "Downloading installer package…"
    } else if lower.contains("verified installer hash") {
        "Verified installer hash"
    } else if lower.contains("starting package install") {
        "Installing update…"
    } else if lower.contains("request to run as administrator") {
        "Waiting for administrator approval…"
    } else if lower.contains("uninstalling") {
        "Removing the previous version…"
    } else if lower.contains("extracting") {
        "Extracting package…"
    } else if lower.contains("successfully installed") {
        "Installer finished successfully"
    } else if lower.contains("restart") || lower.contains("reboot") {
        "Restart may be required"
    } else if lower.contains("installer failed") || lower.contains("installation abandoned") {
        "Installer reported a failure"
    } else {
        return None;
    };
    Some(message.to_string())
}

fn output_mentions_reboot(text: &str) -> bool {
    let lower = text.to_ascii_lowercase();
    (lower.contains("restart") || lower.contains("reboot"))
        && (lower.contains("required") || lower.contains("finish"))
}

fn joined_output(output: &std::process::Output) -> String {
    let mut text = String::new();
    for chunk in [&output.stdout, &output.stderr] {
        if !chunk.is_empty() {
            text.push_str(&String::from_utf8_lossy(chunk));
            if !text.ends_with('\n') {
                text.push('\n');
            }
        }
    }
    strip_ansi(&text)
}

fn clean_lines(text: &str) -> Vec<String> {
    let mut lines = Vec::new();
    for raw in strip_ansi(text).lines() {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            continue;
        }
        if lines.last().map(|last: &String| last == trimmed) == Some(true) {
            continue;
        }
        lines.push(trimmed.to_string());
    }
    lines
}

fn push_log(logs: &mut Vec<String>, line: &str) {
    if logs.last().map(|last| last == line) == Some(true) {
        return;
    }
    if logs.len() >= MAX_LOG_LINES {
        logs.remove(0);
    }
    logs.push(line.to_string());
}

fn summarize_output(text: &str) -> String {
    let lines: Vec<String> = clean_lines(text)
        .into_iter()
        .filter(|line| {
            let lower = line.to_ascii_lowercase();
            !lower.starts_with("this application is licensed")
                && !lower.starts_with("microsoft is not responsible")
                && !lower.starts_with("downloading http")
                && !line.starts_with("http")
                && line.len() > 3
        })
        .take(3)
        .collect();

    if lines.is_empty() {
        "The installer did not report a reason. Open the log for details.".to_string()
    } else {
        lines.join(" ")
    }
}

fn friendly_runner_error(error: &str) -> String {
    if error.contains("Could not start process") {
        return WINGET_MISSING.to_string();
    }
    if error.contains("took longer than") {
        return "The update took too long and was stopped. Check whether the app was updated, then rescan. Large apps such as Visual Studio can take a long time.".to_string();
    }
    error.to_string()
}

fn emit(
    progress: Option<ProgressSink<'_>>,
    update: &SoftwareUpdate,
    status: &str,
    message: &str,
    detail: &str,
    index: usize,
    total: usize,
    requires_reboot: bool,
) -> Option<()> {
    let callback = progress?;
    callback(UpdateProgress {
        id: update.id.clone(),
        name: update.name.clone(),
        status: status.to_string(),
        message: message.to_string(),
        detail: detail.to_string(),
        index,
        total,
        requires_reboot,
    });
    Some(())
}

fn summarize(outcomes: Vec<UpdateOutcome>) -> UpdateSummary {
    let mut summary = UpdateSummary {
        succeeded: 0,
        failed: 0,
        already_current: 0,
        skipped: 0,
        reboot_required: false,
        outcomes,
    };

    for outcome in &summary.outcomes {
        match outcome.status.as_str() {
            "succeeded" => summary.succeeded += 1,
            "already-current" => summary.already_current += 1,
            "skipped" => summary.skipped += 1,
            _ => summary.failed += 1,
        }
        summary.reboot_required |= outcome.requires_reboot;
    }
    summary
}

fn record_outcome(outcome: &UpdateOutcome) {
    log_line(
        "updates.log",
        &format!(
            "{} [{}] {} -> {}: {}",
            outcome.name, outcome.status, outcome.id, outcome.new_version, outcome.message
        ),
    );
    if outcome.status == "failed" {
        for line in outcome.logs.iter().rev().take(12).rev() {
            log_line("updates.log", &format!("  {}", line));
        }
    }
}

impl UpdateOutcome {
    fn failed(
        update: &SoftwareUpdate,
        message: String,
        logs: Vec<String>,
        interactive_retry: bool,
    ) -> Self {
        Self {
            id: update.id.clone(),
            name: update.name.clone(),
            status: "failed".to_string(),
            message,
            new_version: String::new(),
            logs,
            requires_reboot: false,
            interactive_retry,
        }
    }

    fn already_current(update: &SoftwareUpdate, logs: Vec<String>) -> Self {
        Self {
            id: update.id.clone(),
            name: update.name.clone(),
            status: "already-current".to_string(),
            message: "Already up to date.".to_string(),
            new_version: update.current_version.clone(),
            logs,
            requires_reboot: false,
            interactive_retry: false,
        }
    }

    fn skipped(update: &SoftwareUpdate, message: &str) -> Self {
        Self {
            id: update.id.clone(),
            name: update.name.clone(),
            status: "skipped".to_string(),
            message: message.to_string(),
            new_version: String::new(),
            logs: Vec::new(),
            requires_reboot: false,
            interactive_retry: false,
        }
    }
}

/// Removes ANSI colour/OSC sequences from WinGet output.
pub(crate) fn strip_ansi(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch != '\u{1b}' {
            output.push(ch);
            continue;
        }

        match chars.peek() {
            Some('[') => {
                chars.next();
                for ch in chars.by_ref() {
                    if ('@'..='~').contains(&ch) {
                        break;
                    }
                }
            }
            Some(']') => {
                chars.next();
                while let Some(ch) = chars.next() {
                    if ch == '\u{7}' {
                        break;
                    }
                    if ch == '\u{1b}' && chars.peek() == Some(&'\\') {
                        chars.next();
                        break;
                    }
                }
            }
            _ => {}
        }
    }

    output
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"
Name                                                               Id                               Version       Available     Source
--------------------------------------------------------------------------------------------------------------------------------------
Antigravity 2.32.0                                                 Google.Antigravity               2.32.0        2.32.2        winget
Microsoft Visual C++ v14 Redistributable (x64) - 14.51.36247       Microsoft.VCRedist.2015+.x64     14.51.36247.0 14.52.37029.0 winget
Wondershare Filmora 15(Build 15.5.3.19727)                         Wondershare.Filmora              Unknown       16.0.16.22973 winget
Store Video App                                                   9NBLGGH5PNV2                     1.0.0         1.1.0         msstore
No Source App                                                      Example.NoSource                 1.0           2.0
12 upgrades available.
"#;

    #[test]
    fn parses_names_with_spaces_and_unknown_versions() {
        let updates = parse_winget_table(SAMPLE);
        assert_eq!(updates.len(), 5);

        let vc = updates
            .iter()
            .find(|update| update.id == "Microsoft.VCRedist.2015+.x64")
            .expect("VC redist row");
        assert_eq!(
            vc.name,
            "Microsoft Visual C++ v14 Redistributable (x64) - 14.51.36247"
        );
        assert_eq!(vc.available_version, "14.52.37029.0");
        assert_eq!(vc.source, "winget");

        let filmora = updates
            .iter()
            .find(|update| update.id == "Wondershare.Filmora")
            .expect("Filmora row");
        assert_eq!(filmora.current_version, "Unknown");
        assert_eq!(filmora.available_version, "16.0.16.22973");

        let store = updates
            .iter()
            .find(|update| update.id == "9NBLGGH5PNV2")
            .expect("Store row");
        assert_eq!(store.source, "msstore");

        let no_source = updates
            .iter()
            .find(|update| update.id == "Example.NoSource")
            .expect("row without a source");
        assert_eq!(no_source.source, "");
        assert_eq!(no_source.available_version, "2.0");
    }

    #[test]
    fn rejects_footer_and_header_lines() {
        let updates = parse_winget_table(SAMPLE);
        assert!(updates.iter().all(|update| update.id != "Id"));
        assert!(updates
            .iter()
            .all(|update| !update.name.contains("upgrades available")));
    }

    #[test]
    fn strips_ansi_sequences() {
        assert_eq!(strip_ansi("\u{1b}[32mDone\u{1b}[0m"), "Done");
        assert_eq!(strip_ansi("plain text"), "plain text");
    }

    #[test]
    fn builds_safe_exact_upgrade_arguments() {
        let update = SoftwareUpdate {
            id: "Microsoft.VisualStudioCode".into(),
            name: "Visual Studio Code".into(),
            current_version: "1.0".into(),
            available_version: "1.1".into(),
            source: "winget".into(),
        };

        let args = upgrade_arguments(&update, false);
        assert!(args.contains(&"--exact".to_string()));
        assert!(args.contains(&"--include-unknown".to_string()));
        assert!(args.contains(&"--source".to_string()));
        assert!(args.contains(&"winget".to_string()));
        assert!(args.contains(&"--silent".to_string()));
        assert!(args.contains(&"--disable-interactivity".to_string()));

        let interactive = upgrade_arguments(&update, true);
        assert!(!interactive.contains(&"--silent".to_string()));
        assert!(!interactive.contains(&"--disable-interactivity".to_string()));
    }

    #[test]
    fn classifies_common_winget_failures() {
        let update = SoftwareUpdate {
            id: "Example.App".into(),
            name: "Example App".into(),
            current_version: "1.0".into(),
            available_version: "2.0".into(),
            source: "winget".into(),
        };

        let current = classify_failure(&update, Some(0x8A15_002B), "");
        assert_eq!(current.kind, FailureKind::AlreadyCurrent);

        let missing = classify_failure(&update, Some(0x8A15_0014), "");
        assert_eq!(missing.kind, FailureKind::Skipped);

        let reboot = classify_failure(&update, Some(0x8A15_0109), "");
        assert_eq!(reboot.kind, FailureKind::Reboot);

        let busy = classify_failure(&update, Some(0x8A15_0102), "");
        assert_eq!(busy.kind, FailureKind::Busy);
        assert_eq!(busy.max_attempts, 3);

        let in_use = classify_failure(&update, Some(0x8A15_0111), "");
        assert_eq!(in_use.kind, FailureKind::InUse);
        assert!(in_use.message.contains("Example App"));

        let hash = classify_failure(&update, None, "Installer hash does not match");
        assert_eq!(hash.kind, FailureKind::HashMismatch);
    }

    #[test]
    fn extracts_error_codes_from_output() {
        assert_eq!(
            extract_code("Installer failed with error 0x8A150049"),
            Some(0x8A15_0049)
        );
        assert_eq!(extract_code("no code here"), None);
    }

    #[test]
    fn detects_reboot_language() {
        assert!(output_mentions_reboot("A restart is required to finish."));
        assert!(!output_mentions_reboot("Downloading installer package…"));
    }

    #[test]
    fn summarizes_only_actionable_lines() {
        let text = "This application is licensed to you by its owner.\nMicrosoft is not responsible.\nDownloading https://example.test/file.exe\nInstaller failed with exit code 1603.";
        let summary = summarize_output(text);
        assert!(summary.contains("Installer failed"));
        assert!(!summary.contains("licensed"));
        assert!(!summary.contains("https://"));
    }
}
