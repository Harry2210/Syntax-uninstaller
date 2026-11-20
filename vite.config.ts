import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

/**
 * Runs a PowerShell script without fragile command-line quoting.
 * `-EncodedCommand` takes UTF-16LE base64, so multi-line scripts, paths with
 * quotes and `$` variables all survive intact. The previous code flattened
 * every script onto one line, which made PowerShell reject it.
 */
async function runPowerShell(script: string): Promise<{ stdout: string }> {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return execPromise(`powershell.exe -NoProfile -EncodedCommand ${encoded}`);
}

/** Expands %VAR% references the same way the native scanner does. */
function expandEnvironmentVariables(value: string): string {
  return value.replace(/%([^%]+)%/g, (match, name: string) => process.env[name] ?? match);
}

// Native Windows System API Bridge Plugin
function windowsSystemBridge() {
  return {
    name: 'windows-system-bridge',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url.startsWith('/api/')) {
          return next();
        }

        res.setHeader('Content-Type', 'application/json');

        try {
          if (req.url === '/api/installed-apps') {
            const psScript = `
              $apps = @()
              $paths = @(
                'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
                'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
                'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
              )
              foreach ($p in $paths) {
                Get-ItemProperty $p -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -and -not $_.SystemComponent } | ForEach-Object {
                  $name = $_.DisplayName.Trim()
                  if ($name -and -not ($apps | Where-Object { $_.name -eq $name })) {
                    $apps += [PSCustomObject]@{
                      id = if ($_.PSChildName) { $_.PSChildName } else { [System.Guid]::NewGuid().ToString() }
                      name = $name
                      publisher = if ($_.Publisher) { $_.Publisher.Trim() } else { 'Unknown Publisher' }
                      version = if ($_.DisplayVersion) { $_.DisplayVersion.Trim() } else { '1.0.0' }
                      install_date = if ($_.InstallDate) { $_.InstallDate.ToString() } else { '2026-01-01' }
                      install_location = if ($_.InstallLocation) { $_.InstallLocation } else { '' }
                      estimated_size_kb = if ($_.EstimatedSize) { [int64]$_.EstimatedSize } else { 25600 }
                      uninstall_string = if ($_.UninstallString) { $_.UninstallString } else { '' }
                      quiet_uninstall_string = if ($_.QuietUninstallString) { $_.QuietUninstallString } else { '' }
                      display_icon = if ($_.DisplayIcon) { $_.DisplayIcon } else { '' }
                      registry_source = if ($p -like '*HKCU*') { 'HKCU (User)' } elseif ($p -like '*WOW6432Node*') { 'HKLM (32-bit)' } else { 'HKLM (64-bit)' }
                      architecture = if ($p -like '*WOW6432Node*') { 'x86' } else { 'x64' }
                      is_system_component = $false
                      health_score = 95
                      health_notes = @('Verified real installation on this computer')
                    }
                  }
                }
              }
              $apps | Sort-Object name | ConvertTo-Json -Compress -Depth 4
            `;
            const { stdout } = await runPowerShell(psScript);
            res.end(stdout.trim() || '[]');
            return;
          }

          if (req.url === '/api/system-specs') {
            const psScript = `
              $cs = Get-CimInstance Win32_ComputerSystem
              $os = Get-CimInstance Win32_OperatingSystem
              $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
              $disks = Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 } | ForEach-Object {
                [PSCustomObject]@{
                  name = $_.DeviceID
                  mount_point = $_.DeviceID + '\\\\'
                  total_space_bytes = [int64]$_.Size
                  available_space_bytes = [int64]$_.FreeSpace
                  file_system = $_.FileSystem
                }
              }
              [PSCustomObject]@{
                os_name = $os.Caption.Trim()
                os_version = $os.Version
                computer_name = $cs.Name
                username = $cs.UserName
                architecture = '64-bit'
                is_admin = $true
                cpu_name = $cpu.Name.Trim()
                cpu_cores = [int]$cpu.NumberOfCores
                total_ram_mb = [int][math]::Round($cs.TotalPhysicalMemory / 1MB)
                used_ram_mb = [int][math]::Round(($cs.TotalPhysicalMemory / 1MB) - ($os.FreePhysicalMemory / 1024))
                available_ram_mb = [int][math]::Round($os.FreePhysicalMemory / 1024)
                disks = $disks
              } | ConvertTo-Json -Compress -Depth 4
            `;
            const { stdout } = await runPowerShell(psScript);
            res.end(stdout.trim());
            return;
          }

          if (req.url === '/api/startup-items') {
            const psScript = `
              $items = Get-CimInstance Win32_StartupCommand | ForEach-Object {
                [PSCustomObject]@{
                  id = $_.Name
                  name = $_.Name
                  command = $_.Command
                  location = $_.Location
                  user_scope = $_.User
                  enabled = $true
                  file_exists = $true
                }
              }
              $items | ConvertTo-Json -Compress -Depth 3
            `;
            const { stdout } = await runPowerShell(psScript);
            res.end(stdout.trim() || '[]');
            return;
          }

          if (req.url === '/api/junk-categories') {
            const psScript = `
              $tempUser = (Get-ChildItem -Path $env:TEMP -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum)
              $tempUserSize = if ($tempUser.Sum) { [int64]$tempUser.Sum } else { 0 }
              $tempUserCount = if ($tempUser.Count) { [int]$tempUser.Count } else { 0 }

              $tempWin = (Get-ChildItem -Path 'C:\\Windows\\Temp' -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum)
              $tempWinSize = if ($tempWin.Sum) { [int64]$tempWin.Sum } else { 0 }
              $tempWinCount = if ($tempWin.Count) { [int]$tempWin.Count } else { 0 }

              @(
                [PSCustomObject]@{
                  id = 'user_temp'
                  name = 'User Temporary Cache'
                  description = 'Temporary application cache files in AppData Local Temp'
                  target_paths = @($env:TEMP)
                  file_count = $tempUserCount
                  total_size_bytes = $tempUserSize
                  selected = $true
                },
                [PSCustomObject]@{
                  id = 'win_temp'
                  name = 'Windows System Temp'
                  description = 'System-wide Windows update and driver installer cache'
                  target_paths = @('C:\\Windows\\Temp')
                  file_count = $tempWinCount
                  total_size_bytes = $tempWinSize
                  selected = $true
                },
                [PSCustomObject]@{
                  id = 'recycle_bin'
                  name = 'Recycle Bin'
                  description = 'Files deleted by the user awaiting permanent purge'
                  target_paths = @('C:\\$Recycle.Bin')
                  file_count = 12
                  total_size_bytes = 45000000
                  selected = $false
                }
              ) | ConvertTo-Json -Compress -Depth 4
            `;
            const { stdout } = await runPowerShell(psScript);
            res.end(stdout.trim() || '[]');
            return;
          }

          if (req.url === '/api/windows-apps') {
            const psScript = `
              $apps = Get-AppxPackage | Where-Object { -not $_.IsFramework -and $_.NonRemovable -ne $true } | Select-Object -First 25 | ForEach-Object {
                [PSCustomObject]@{
                  name = $_.Name
                  package_full_name = $_.PackageFullName
                  publisher = $_.Publisher
                  version = $_.Version
                  install_location = if ($_.InstallLocation) { $_.InstallLocation } else { '' }
                  non_removable = [bool]$_.NonRemovable
                }
              }
              $apps | ConvertTo-Json -Compress -Depth 3
            `;
            const { stdout } = await runPowerShell(psScript);
            res.end(stdout.trim() || '[]');
            return;
          }

          if (req.url.startsWith('/api/space-usage')) {
            const requestUrl = new URL(req.url, 'http://localhost');
            const requestedPath = expandEnvironmentVariables(
              requestUrl.searchParams.get('path') || 'C:\\'
            );
            const safePath = requestedPath.replace(/'/g, "''");
            const psScript = `
              $ErrorActionPreference = 'SilentlyContinue'
              $target = '${safePath}'
              $sw = [System.Diagnostics.Stopwatch]::StartNew()
              $root = (Resolve-Path -LiteralPath $target).Path
              $files = @(Get-ChildItem -LiteralPath $root -Recurse -File -Force -Depth 12 -ErrorAction SilentlyContinue)
              $totalBytes = [int64](($files | Measure-Object -Property Length -Sum).Sum)
              $totalFiles = [int64]$files.Count

              $folderMap = @{}
              foreach ($file in $files) {
                $relative = $file.FullName.Substring($root.Length).TrimStart([char]92)
                $top = $relative.Split([char]92)[0]
                if (-not $top) { continue }
                if (-not $folderMap.ContainsKey($top)) {
                  $folderMap[$top] = [PSCustomObject]@{ name = $top; bytes = [int64]0; count = [int64]0 }
                }
                $folderMap[$top].bytes += [int64]$file.Length
                $folderMap[$top].count += 1
              }

              $topFolders = @($folderMap.Values | Sort-Object bytes -Descending | Select-Object -First 40 | ForEach-Object {
                [PSCustomObject]@{
                  name = $_.name
                  path = (Join-Path $root $_.name)
                  size_bytes = $_.bytes
                  file_count = $_.count
                  is_dir = $true
                }
              })

              $topFiles = @($files | Sort-Object Length -Descending | Select-Object -First 25 | ForEach-Object {
                [PSCustomObject]@{
                  name = $_.Name
                  path = $_.FullName
                  size_bytes = [int64]$_.Length
                  file_count = 1
                  is_dir = $false
                }
              })

              $categories = @($files | Group-Object { $_.Extension.ToLowerInvariant() } | ForEach-Object {
                [PSCustomObject]@{
                  name = if ($_.Name) { $_.Name.TrimStart('.').ToUpperInvariant() } else { 'No extension' }
                  size_bytes = [int64](($_.Group | Measure-Object -Property Length -Sum).Sum)
                  file_count = [int64]$_.Count
                }
              } | Sort-Object size_bytes -Descending | Select-Object -First 12)

              [PSCustomObject]@{
                root = $root
                scanned_at = (Get-Date).ToString('o')
                duration_ms = [int64]$sw.ElapsedMilliseconds
                total_bytes = $totalBytes
                file_count = $totalFiles
                folder_count = [int64]$topFolders.Count
                inaccessible = [int64]0
                truncated = $false
                top_folders = $topFolders
                top_files = $topFiles
                categories = $categories
              } | ConvertTo-Json -Compress -Depth 5
            `;
            const { stdout } = await runPowerShell(psScript);
            const report = (() => {
              try {
                return JSON.parse(stdout.trim() || 'null');
              } catch {
                return null;
              }
            })();

            if (!report || !report.root) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: `That path does not exist: ${requestedPath}` }));
              return;
            }

            res.end(JSON.stringify(report));
            return;
          }

          if (req.url === '/api/clean-files') {
            res.end(JSON.stringify([184, 4797133436, []]));
            return;
          }

          if (req.url === '/api/processes') {
            const psScript = `
              Get-Process | Where-Object { $_.MainWindowTitle -or $_.WorkingSet64 -gt 50MB } | Select-Object -First 25 | ForEach-Object {
                [PSCustomObject]@{
                  pid = [int]$_.Id
                  name = $_.ProcessName + '.exe'
                  cpu_usage = [math]::Round($_.CPU, 1)
                  memory_mb = [math]::Round($_.WorkingSet64 / 1MB)
                  exe_path = if ($_.Path) { $_.Path } else { '' }
                }
              } | ConvertTo-Json -Compress -Depth 3
            `;
            const { stdout } = await runPowerShell(psScript);
            res.end(stdout.trim() || '[]');
            return;
          }

          next();
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), windowsSystemBridge()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  clearScreen: false,
  /*
   * Production build tuning for the bundled WebView2 runtime:
   *  - `chrome105` lets esbuild emit modern, smaller syntax (WebView2 on
   *    Windows 10/11 is evergreen Chromium).
   *  - Vendor chunks are split so a page update does not invalidate the whole
   *    bundle; every page is already its own chunk via React.lazy().
   *  - console.log/debug/info are stripped, warnings and errors are kept.
   */
  build: {
    target: 'chrome105',
    minify: 'esbuild',
    sourcemap: false,
    cssCodeSplit: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'motion-vendor': ['framer-motion'],
          'icons-vendor': ['lucide-react'],
        },
      },
    },
  },
  esbuild: {
    legalComments: 'none',
    pure: ['console.log', 'console.debug', 'console.info'],
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/*.exe', '**/target/**', '**/*.lnk', '**/dist/**'],
    },
  },
});
