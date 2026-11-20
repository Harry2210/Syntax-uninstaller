use serde::{Deserialize, Serialize};
use std::time::Duration;
use windows::core::BSTR;
use windows::Win32::Foundation::RPC_E_CHANGED_MODE;
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED,
};
use windows::Win32::System::TaskScheduler::{
    ITaskFolder, ITaskService, TaskScheduler, TASK_STATE, TASK_STATE_DISABLED, TASK_STATE_QUEUED,
    TASK_STATE_READY, TASK_STATE_RUNNING, TASK_STATE_UNKNOWN,
};
use windows::Win32::System::Variant::{VARIANT, VT_I4};

use crate::modules::cache::{self, invalidate};
use crate::modules::winproc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledTaskItem {
    #[serde(
        default,
        deserialize_with = "crate::modules::serde_util::string_or_default"
    )]
    pub name: String,
    #[serde(
        default,
        deserialize_with = "crate::modules::serde_util::string_or_default"
    )]
    pub path: String,
    #[serde(
        default,
        deserialize_with = "crate::modules::serde_util::string_or_default"
    )]
    pub state: String,
    #[serde(
        default,
        deserialize_with = "crate::modules::serde_util::string_or_default"
    )]
    pub author: String,
}

const CACHE_TTL: Duration = Duration::from_secs(20);

pub fn get_scheduled_tasks() -> Vec<ScheduledTaskItem> {
    cache::cached("scheduled_tasks:list", CACHE_TTL, || {
        // The Task Scheduler COM API is in-process and usually completes in a
        // few milliseconds. The previous implementation started PowerShell and
        // piped its JSON through the command line (~600 ms per scan).
        match native_scheduled_tasks() {
            Ok(tasks) if !tasks.is_empty() => tasks,
            _ => powershell_scheduled_tasks(),
        }
    })
}

/// Reads every task in every folder through the Task Scheduler COM service.
fn native_scheduled_tasks() -> Result<Vec<ScheduledTaskItem>, String> {
    let com = ComGuard::new()?;

    let service: ITaskService = unsafe {
        CoCreateInstance(&TaskScheduler, None, CLSCTX_INPROC_SERVER)
            .map_err(|error| format!("Task Scheduler COM service unavailable: {error}"))?
    };

    let empty = VARIANT::default();
    unsafe {
        service
            .Connect(&empty, &empty, &empty, &empty)
            .map_err(|error| format!("Could not connect to Task Scheduler: {error}"))?;
    }

    let root = unsafe {
        service
            .GetFolder(&BSTR::from("\\"))
            .map_err(|error| format!("Could not open the Task Scheduler root folder: {error}"))?
    };

    let mut tasks = Vec::new();
    collect_folder_tasks(&root, "\\", 0, &mut tasks);

    // COM objects must be released before CoUninitialize runs.
    drop(root);
    drop(service);
    drop(com);

    tasks.sort_by(|left, right| {
        left.name
            .to_lowercase()
            .cmp(&right.name.to_lowercase())
            .then_with(|| left.path.cmp(&right.path))
    });
    Ok(tasks)
}

/// Recursively reads the tasks and subfolders below `folder`.
fn collect_folder_tasks(
    folder: &ITaskFolder,
    folder_path: &str,
    depth: u32,
    output: &mut Vec<ScheduledTaskItem>,
) {
    // A hard recursion cap protects against malformed or adversarial folders.
    if depth > 16 {
        return;
    }

    // Flag 1 = include hidden tasks. `Get-ScheduledTask` exposed those too.
    if let Ok(collection) = unsafe { folder.GetTasks(1) } {
        if let Ok(count) = unsafe { collection.Count() } {
            for index in 1..=count {
                let variant = variant_i4(index);
                let task = match unsafe { collection.get_Item(&variant) } {
                    Ok(task) => task,
                    Err(_) => continue,
                };

                let name = unsafe { task.Name() }
                    .map(|value| value.to_string())
                    .unwrap_or_default();
                if name.is_empty() {
                    continue;
                }

                let state = unsafe { task.State() }
                    .map(task_state_name)
                    .unwrap_or("Unknown");

                let author = unsafe { task.Definition() }
                    .ok()
                    .and_then(|definition| unsafe { definition.RegistrationInfo() }.ok())
                    .and_then(|registration| {
                        let mut value = BSTR::new();
                        unsafe { registration.Author(&mut value) }
                            .ok()
                            .map(|_| value.to_string())
                            .filter(|author| !author.trim().is_empty())
                    })
                    .unwrap_or_default();

                output.push(ScheduledTaskItem {
                    name,
                    path: folder_path.to_string(),
                    state: state.to_string(),
                    author,
                });
            }
        }
    }

    if let Ok(folders) = unsafe { folder.GetFolders(0) } {
        if let Ok(count) = unsafe { folders.Count() } {
            for index in 1..=count {
                let variant = variant_i4(index);
                let child = match unsafe { folders.get_Item(&variant) } {
                    Ok(folder) => folder,
                    Err(_) => continue,
                };
                let name = unsafe { child.Name() }
                    .map(|value| value.to_string())
                    .unwrap_or_default();
                if name.is_empty() {
                    continue;
                }
                let child_path = if folder_path == "\\" {
                    format!("\\{}", name)
                } else {
                    format!("{}\\{}", folder_path, name)
                };
                collect_folder_tasks(&child, &child_path, depth + 1, output);
            }
        }
    }
}

fn variant_i4(value: i32) -> VARIANT {
    let mut variant = VARIANT::default();
    unsafe {
        let inner = &mut *variant.Anonymous.Anonymous;
        inner.vt = VT_I4;
        inner.Anonymous.lVal = value;
    }
    variant
}

fn task_state_name(state: TASK_STATE) -> &'static str {
    if state == TASK_STATE_READY {
        "Ready"
    } else if state == TASK_STATE_RUNNING {
        "Running"
    } else if state == TASK_STATE_DISABLED {
        "Disabled"
    } else if state == TASK_STATE_QUEUED {
        "Queued"
    } else if state == TASK_STATE_UNKNOWN {
        "Unknown"
    } else {
        "Unknown"
    }
}

/// Owns a COM apartment for the duration of a scan. If the thread was already
/// initialised (common in a thread pool), the existing apartment is reused.
struct ComGuard {
    owns_apartment: bool,
}

impl ComGuard {
    fn new() -> Result<Self, String> {
        let result = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
        if result.is_ok() {
            return Ok(Self {
                owns_apartment: true,
            });
        }
        if result == RPC_E_CHANGED_MODE {
            return Ok(Self {
                owns_apartment: false,
            });
        }
        Err(format!("Could not initialize COM: {result:?}"))
    }
}

impl Drop for ComGuard {
    fn drop(&mut self) {
        if self.owns_apartment {
            unsafe { CoUninitialize() };
        }
    }
}

/// Fallback for environments where the Task Scheduler COM service is blocked.
fn powershell_scheduled_tasks() -> Vec<ScheduledTaskItem> {
    let script = r#"
        Get-ScheduledTask |
        Select-Object @{Name='name';Expression={$_.TaskName}},
                      @{Name='path';Expression={$_.TaskPath}},
                      @{Name='state';Expression={$_.State.ToString()}},
                      @{Name='author';Expression={if ($_.Author) { $_.Author } else { '' }}} |
        ConvertTo-Json -Compress
    "#;

    let stdout = match winproc::powershell(script, winproc::DEFAULT_TIMEOUT) {
        Ok(out) => out,
        Err(_) => return Vec::new(),
    };

    if stdout.trim().is_empty() {
        return Vec::new();
    }

    match serde_json::from_str::<Vec<ScheduledTaskItem>>(&stdout) {
        Ok(tasks) => tasks,
        Err(_) => serde_json::from_str::<ScheduledTaskItem>(&stdout)
            .map(|single| vec![single])
            .unwrap_or_default(),
    }
}

pub fn toggle_scheduled_task(task_name: &str, enable: bool) -> Result<(), String> {
    let verb = if enable {
        "Enable-ScheduledTask"
    } else {
        "Disable-ScheduledTask"
    };
    let script = format!("{} -TaskName {}", verb, winproc::ps_string(task_name));

    winproc::powershell(&script, Duration::from_secs(45))?;
    invalidate("scheduled_tasks:");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_task_states_to_the_ui_vocabulary() {
        assert_eq!(task_state_name(TASK_STATE_READY), "Ready");
        assert_eq!(task_state_name(TASK_STATE_RUNNING), "Running");
        assert_eq!(task_state_name(TASK_STATE_DISABLED), "Disabled");
        assert_eq!(task_state_name(TASK_STATE_QUEUED), "Queued");
        assert_eq!(task_state_name(TASK_STATE_UNKNOWN), "Unknown");
    }

    #[test]
    fn builds_a_one_based_variant() {
        let variant = variant_i4(7);
        unsafe {
            let inner = &*variant.Anonymous.Anonymous;
            assert_eq!(inner.vt, VT_I4);
            assert_eq!(inner.Anonymous.lVal, 7);
        }
    }
}
