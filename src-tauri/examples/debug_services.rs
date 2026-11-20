//! Diagnostic: dumps the raw PowerShell output for the services query.
//!
//! Run with:  cargo run --example debug_services

use std::time::Duration;
use syntax_uninstaller_lib::modules::services::WinService;
use syntax_uninstaller_lib::modules::winproc;

fn main() {
    let script = r#"
        Get-Service |
        Select-Object @{Name='name';Expression={$_.Name}},
                      @{Name='display_name';Expression={$_.DisplayName}},
                      @{Name='status';Expression={$_.Status.ToString()}},
                      @{Name='start_type';Expression={$_.StartType.ToString()}} |
        ConvertTo-Json -Compress
    "#;

    match winproc::powershell(script, Duration::from_secs(30)) {
        Ok(out) => {
            println!("ok: {} bytes", out.len());
            match serde_json::from_str::<Vec<WinService>>(&out) {
                Ok(v) => println!("parsed: {} services", v.len()),
                Err(e) => {
                    println!("serde error: {}", e);
                    let line = e.line();
                    println!("line {} column {}", line, e.column());
                }
            }
        }
        Err(e) => println!("error: {}", e),
    }
}
