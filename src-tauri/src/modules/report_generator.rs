use crate::modules::{applications, cleaner, debloater, system_info};
use std::fs;

pub fn generate_audit_html() -> String {
    let specs = system_info::get_system_specs();
    let apps = applications::get_installed_apps();
    let debloat = debloater::get_debloat_items();
    let junk = cleaner::scan_junk_categories();

    let total_junk_mb: u64 = junk.iter().map(|j| j.total_size_bytes).sum::<u64>() / (1024 * 1024);
    let healthy_apps_count = apps.iter().filter(|a| a.health_score >= 80).count();
    let low_health_count = apps.iter().filter(|a| a.health_score < 70).count();
    let shielded_count = debloat.iter().filter(|d| d.is_shielded).count();

    let now = chrono::Local::now()
        .format("%B %d, %Y - %H:%M:%S")
        .to_string();

    let mut app_rows = String::new();
    for app in apps.iter().take(30) {
        let size_mb = app.estimated_size_kb / 1024;
        let score_color = if app.health_score >= 80 {
            "#22C7A9"
        } else if app.health_score >= 60 {
            "#F5B942"
        } else {
            "#F06464"
        };
        app_rows.push_str(&format!(
            r#"<tr>
                <td style="font-weight:600; padding:8px 12px; border-bottom:1px solid #283448;">{}</td>
                <td style="padding:8px 12px; border-bottom:1px solid #283448; color:#98A4B7;">{}</td>
                <td style="padding:8px 12px; border-bottom:1px solid #283448; font-family:monospace; color:#98A4B7;">v{}</td>
                <td style="padding:8px 12px; border-bottom:1px solid #283448; font-family:monospace;">{} MB</td>
                <td style="padding:8px 12px; border-bottom:1px solid #283448; font-weight:700; color:{};">{}%</td>
            </tr>"#,
            app.name, app.publisher, app.version, size_mb, score_color, app.health_score
        ));
    }

    format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Syntax Uninstaller Pro — System Health Audit Certificate</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #0B0F19;
            color: #F5F7FB;
            margin: 0;
            padding: 40px;
        }}
        .container {{
            max-width: 900px;
            margin: 0 auto;
            background: #151E2E;
            border: 1px solid #283448;
            border-radius: 16px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.5);
        }}
        .header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #7C5CFC;
            padding-bottom: 24px;
            margin-bottom: 30px;
        }}
        .logo-title {{
            font-size: 24px;
            font-weight: 800;
            color: #F5F7FB;
            letter-spacing: -0.5px;
        }}
        .logo-tag {{
            color: #7C5CFC;
        }}
        .date {{
            font-size: 12px;
            color: #98A4B7;
            font-family: monospace;
        }}
        .metric-grid {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 30px;
        }}
        .metric-card {{
            background: #101726;
            border: 1px solid #283448;
            border-radius: 12px;
            padding: 16px;
            text-align: center;
        }}
        .metric-value {{
            font-size: 26px;
            font-weight: 800;
            color: #22C7A9;
            margin-bottom: 4px;
        }}
        .metric-label {{
            font-size: 11px;
            text-transform: uppercase;
            color: #98A4B7;
            font-weight: 600;
        }}
        .section-title {{
            font-size: 16px;
            font-weight: 700;
            color: #F5F7FB;
            margin: 24px 0 12px 0;
            border-left: 4px solid #7C5CFC;
            padding-left: 10px;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            text-align: left;
        }}
        th {{
            background: #101726;
            color: #98A4B7;
            padding: 10px 12px;
            border-bottom: 2px solid #283448;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 10px;
        }}
        .footer {{
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #283448;
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #98A4B7;
            font-family: monospace;
        }}
        @media print {{
            body {{ background: #fff; color: #000; padding: 0; }}
            .container {{ box-shadow: none; border: 1px solid #ddd; max-width: 100%; }}
            .metric-card {{ border: 1px solid #ddd; background: #fafafa; }}
            .metric-value {{ color: #008866; }}
            th {{ background: #eee; color: #333; }}
            td {{ border-bottom: 1px solid #eee; }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div>
                <div class="logo-title">SYNTAX<span class="logo-tag">UNINSTALLER</span> PRO</div>
                <div style="font-size:12px; color:#98A4B7; margin-top:4px;">Diagnostic System Health &amp; Software Integrity Audit</div>
            </div>
            <div style="text-align:right;">
                <div style="font-weight:bold; color:#22C7A9;">CERTIFIED REPORT</div>
                <div class="date">{}</div>
            </div>
        </div>

        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-value">{}</div>
                <div class="metric-label">Installed Apps</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" style="color:#22C7A9;">{}</div>
                <div class="metric-label">Healthy Apps</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" style="color:#F06464;">{}</div>
                <div class="metric-label">Orphaned / Risk</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" style="color:#7C5CFC;">{}/10</div>
                <div class="metric-label">Privacy Shield</div>
            </div>
        </div>

        <div class="section-title">Host Hardware &amp; Platform Profile</div>
        <div style="background:#101726; border:1px solid #283448; border-radius:12px; padding:16px; font-size:12px; display:grid; grid-template-columns:1fr 1fr; gap:12px; font-family:monospace;">
            <div>Computer Name: <span style="color:#F5F7FB; font-weight:bold;">{}</span></div>
            <div>User Account: <span style="color:#F5F7FB;">{} (Admin: {})</span></div>
            <div>Operating System: <span style="color:#F5F7FB;">{} {}</span></div>
            <div>Architecture: <span style="color:#F5F7FB;">{}</span></div>
            <div>Processor Core: <span style="color:#F5F7FB;">{}</span></div>
            <div>Total Memory: <span style="color:#F5F7FB;">{} MB RAM</span></div>
        </div>

        <div class="section-title">Installed Software Catalog (Sample Top 30)</div>
        <table>
            <thead>
                <tr>
                    <th>Application Name</th>
                    <th>Publisher</th>
                    <th>Version</th>
                    <th>Est. Size</th>
                    <th>Health</th>
                </tr>
            </thead>
            <tbody>
                {}
            </tbody>
        </table>

        <div class="footer">
            <div>Syntax Uninstaller Pro v1.0.0 &bull; Kernel Diagnostic Architecture</div>
            <div>Cleanable Junk Staged: {} MB</div>
        </div>
    </div>
</body>
</html>"#,
        now,
        apps.len(),
        healthy_apps_count,
        low_health_count,
        shielded_count,
        specs.computer_name,
        specs.username,
        specs.is_admin,
        specs.os_name,
        specs.os_version,
        specs.architecture,
        specs.cpu_name,
        specs.total_ram_mb,
        app_rows,
        total_junk_mb
    )
}

pub fn export_audit_report(dest_path: &str) -> Result<String, String> {
    let html = generate_audit_html();
    fs::write(dest_path, html).map_err(|e| format!("Failed to export audit report: {}", e))?;
    Ok(format!(
        "Audit report exported successfully to '{}'",
        dest_path
    ))
}
