//! Safe, invisible process execution for the native backend.
//!
//! WHY THIS MODULE EXISTS
//! ----------------------
//! Every `std::process::Command` used to be spawned *without* the Windows
//! `CREATE_NO_WINDOW` flag. Windows therefore allocated a console window for
//! each `powershell.exe`, `cmd.exe`, `reg.exe` and `winget.exe` child, which is
//! why a black "cmd" window flashed over the app several times per scan.
//! Centralising process creation here fixes that for every call site and adds:
//!
//!   * a hard timeout, so a hung `winget`/PowerShell can never freeze a scan;
//!   * reader threads, so large outputs (service / AppX lists) cannot deadlock
//!     on a full pipe buffer;
//!   * `ps_string`, so names interpolated into PowerShell scripts are escaped
//!     instead of being a command-injection vector;
//!   * `shell_open`, which launches `.msc`/`.exe` admin tools through
//!     ShellExecuteW with no console process at all.

use std::io::Read;
use std::process::{Command, Output, Stdio};
use std::sync::mpsc;
use std::time::{Duration, Instant};

/// Windows `CREATE_NO_WINDOW` process creation flag.
pub const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Default budget for short-lived helper processes.
pub const DEFAULT_TIMEOUT: Duration = Duration::from_secs(25);

/// Builds a `Command` that never allocates a console window and never waits for
/// stdin. stdout/stderr are piped so the caller can read them after the wait.
pub fn hidden(program: &str) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());
    cmd
}

/// Like [`hidden`], but the child inherits the parent's stdio.
///
/// Use this for long-running interactive children (uninstallers): nothing can
/// block on an unread 64 KB pipe buffer, and the child still shows its own GUI.
pub fn hidden_inherit(program: &str) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::inherit());
    cmd.stderr(Stdio::inherit());
    cmd
}

/// Runs a command to completion, killing it if it exceeds `timeout`.
///
/// stdout/stderr are drained on dedicated threads while we poll the child, so a
/// chatty process that fills the 64 KB pipe buffer still makes progress.
pub fn run_with_timeout(mut cmd: Command, timeout: Duration) -> Result<Output, String> {
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Could not start process: {}", e))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let out_thread = stdout.map(|mut s| {
        std::thread::spawn(move || {
            let mut buffer = Vec::new();
            let _ = s.read_to_end(&mut buffer);
            buffer
        })
    });
    let err_thread = stderr.map(|mut s| {
        std::thread::spawn(move || {
            let mut buffer = Vec::new();
            let _ = s.read_to_end(&mut buffer);
            buffer
        })
    });

    let deadline = Instant::now() + timeout;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    // Intentionally do NOT join the reader threads: a surviving
                    // grandchild could hold the pipe open forever and hang the
                    // command. They terminate when the handle is released.
                    return Err(format!(
                        "The helper process took longer than {} seconds and was stopped.",
                        timeout.as_secs()
                    ));
                }
                std::thread::sleep(Duration::from_millis(25));
            }
            Err(e) => return Err(format!("Could not read process state: {}", e)),
        }
    };

    let stdout = out_thread.and_then(|h| h.join().ok()).unwrap_or_default();
    let stderr = err_thread.and_then(|h| h.join().ok()).unwrap_or_default();

    Ok(Output {
        status,
        stdout,
        stderr,
    })
}

/// Like [`run_with_timeout`], but reports every output line as it arrives.
///
/// Long-running installers (WinGet upgrades) can run for many minutes. This
/// keeps the UI informed instead of showing a frozen spinner, and still
/// enforces a hard timeout so a stuck installer cannot hang the update queue
/// forever. The returned `Output` contains the same text that was streamed.
pub fn run_streaming_with_timeout<F>(
    mut cmd: Command,
    timeout: Duration,
    mut on_line: F,
) -> Result<Output, String>
where
    F: FnMut(&str),
{
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Could not start process: {}", e))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let (tx, rx) = mpsc::channel::<(bool, String)>();

    // The reader handles are intentionally not retained or joined: a detached
    // grandchild can inherit the pipe and keep it open long after WinGet exits,
    // which would otherwise hang this thread past the timeout.
    if let Some(stream) = stdout {
        spawn_line_reader(stream, false, tx.clone());
    }
    if let Some(stream) = stderr {
        spawn_line_reader(stream, true, tx.clone());
    }
    drop(tx);

    let mut stdout_text = String::new();
    let mut stderr_text = String::new();

    let drain = |rx: &mpsc::Receiver<(bool, String)>,
                 stdout_text: &mut String,
                 stderr_text: &mut String,
                 on_line: &mut F| {
        while let Ok((is_stderr, line)) = rx.try_recv() {
            if is_stderr {
                stderr_text.push_str(&line);
                stderr_text.push('\n');
            } else {
                stdout_text.push_str(&line);
                stdout_text.push('\n');
            }
            on_line(&line);
        }
    };

    let deadline = Instant::now() + timeout;
    let status = loop {
        drain(&rx, &mut stdout_text, &mut stderr_text, &mut on_line);

        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    // As in `run_with_timeout`, do not join the readers: a
                    // surviving grandchild can hold the pipe open.
                    return Err(format!(
                        "The helper process took longer than {} seconds and was stopped.",
                        timeout.as_secs()
                    ));
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(e) => return Err(format!("Could not read process state: {}", e)),
        }
    };

    // Drain whatever the readers already buffered, then wait for a short quiet
    // period. This captures the final lines without risking a permanent join.
    let mut quiet_until = Instant::now() + Duration::from_millis(250);
    loop {
        match rx.recv_timeout(Duration::from_millis(50)) {
            Ok((is_stderr, line)) => {
                if is_stderr {
                    stderr_text.push_str(&line);
                    stderr_text.push('\n');
                } else {
                    stdout_text.push_str(&line);
                    stdout_text.push('\n');
                }
                on_line(&line);
                quiet_until = Instant::now() + Duration::from_millis(250);
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                if Instant::now() >= quiet_until {
                    break;
                }
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }

    Ok(Output {
        status,
        stdout: stdout_text.into_bytes(),
        stderr: stderr_text.into_bytes(),
    })
}

fn spawn_line_reader<R: Read + Send + 'static>(
    stream: R,
    is_stderr: bool,
    tx: mpsc::Sender<(bool, String)>,
) -> std::thread::JoinHandle<()> {
    std::thread::spawn(move || {
        let mut reader = std::io::BufReader::new(stream);
        let mut buffer = Vec::new();

        loop {
            buffer.clear();
            match std::io::BufRead::read_until(&mut reader, b'\n', &mut buffer) {
                Ok(0) => break,
                Ok(_) => {
                    let text = String::from_utf8_lossy(&buffer);
                    // WinGet redraws progress bars with a bare carriage return.
                    for part in text.split(['\r', '\n']) {
                        let line = part.trim();
                        if !line.is_empty() && tx.send((is_stderr, line.to_string())).is_err() {
                            return;
                        }
                    }
                }
                Err(_) => break,
            }
        }
    })
}

/// Runs a PowerShell script invisibly and returns stdout on success.
pub fn powershell(script: &str, timeout: Duration) -> Result<String, String> {
    let mut cmd = hidden("powershell");
    cmd.args([
        "-NoProfile",
        "-NonInteractive",
        "-NoLogo",
        "-ExecutionPolicy",
        "Bypass",
        "-WindowStyle",
        "Hidden",
        "-Command",
        script,
    ]);

    let output = run_with_timeout(cmd, timeout)?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let err = String::from_utf8_lossy(&output.stderr);
        Err(format!("PowerShell failed: {}", err.trim()))
    }
}

/// Escapes a value for safe interpolation inside a single-quoted PowerShell
/// string. Prevents a crafted service/task/package name from injecting code.
pub fn ps_string(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

/// Launches a shell target (".msc", ".exe", URL…) through ShellExecuteW.
///
/// This never creates a console: `cmd /C start` used to flash a console window
/// for every tool launched from the Windows Tools page.
pub fn shell_open(target: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;

        #[link(name = "shell32")]
        extern "system" {
            fn ShellExecuteW(
                hwnd: *mut std::ffi::c_void,
                lp_operation: *const u16,
                lp_file: *const u16,
                lp_parameters: *const u16,
                lp_directory: *const u16,
                n_show_cmd: i32,
            ) -> isize;
        }

        const SW_SHOWNORMAL: i32 = 1;

        fn wide(value: &str) -> Vec<u16> {
            OsStr::new(value).encode_wide().chain(Some(0)).collect()
        }

        let operation = wide("open");
        let file = wide(target);

        let result = unsafe {
            ShellExecuteW(
                std::ptr::null_mut(),
                operation.as_ptr(),
                file.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                SW_SHOWNORMAL,
            )
        };

        // ShellExecuteW returns a value > 32 on success.
        if result > 32 {
            return Ok(());
        }
        return Err(format!(
            "Windows could not open '{}' (ShellExecute code {}).",
            target, result
        ));
    }

    #[cfg(not(windows))]
    {
        let _ = target;
        Err("Launching shell targets is only supported on Windows.".into())
    }
}
