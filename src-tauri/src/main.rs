// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(windows)]
fn ensure_administrator() {
    if !syntax_uninstaller_lib::modules::system_info::is_elevated() {
        if let Ok(current_exe) = std::env::current_exe() {
            let args: Vec<String> = std::env::args().skip(1).collect();
            let args_str = args.join(" ");

            use std::ffi::OsStr;
            use std::os::windows::ffi::OsStrExt;

            let exe_wide: Vec<u16> = current_exe
                .as_os_str()
                .encode_wide()
                .chain(Some(0))
                .collect();
            let args_wide: Vec<u16> = OsStr::new(&args_str).encode_wide().chain(Some(0)).collect();
            let verb_wide: Vec<u16> = OsStr::new("runas").encode_wide().chain(Some(0)).collect();

            #[link(name = "shell32")]
            extern "system" {
                fn ShellExecuteW(
                    hwnd: *mut std::ffi::c_void,
                    operation: *const u16,
                    file: *const u16,
                    parameters: *const u16,
                    directory: *const u16,
                    show_cmd: i32,
                ) -> isize;
            }

            let result = unsafe {
                ShellExecuteW(
                    std::ptr::null_mut(),
                    verb_wide.as_ptr(),
                    exe_wide.as_ptr(),
                    if args_str.is_empty() {
                        std::ptr::null()
                    } else {
                        args_wide.as_ptr()
                    },
                    std::ptr::null(),
                    1, // SW_SHOWNORMAL
                )
            };

            // If ShellExecute triggered elevation successfully (result > 32), exit non-elevated instance
            if result > 32 {
                std::process::exit(0);
            }
        }
    }
}

fn main() {
    #[cfg(windows)]
    ensure_administrator();

    syntax_uninstaller_lib::run();
}
