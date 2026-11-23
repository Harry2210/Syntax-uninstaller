# Production Build Script for Syntax Uninstaller
#
# Usage:  powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1
#
# Steps: type-check + bundle the React frontend, run the automated tests, then
# package the native desktop app and refresh the standalone .exe in the repo root.

$ErrorActionPreference = 'Stop'

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Building Syntax Uninstaller (Production Release)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# Step 1: Build React Frontend (tsc --noEmit + vite build)
Write-Host "`n[1/4] Type-checking and bundling the React 19 + TypeScript frontend..." -ForegroundColor Yellow
& npm.cmd run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend build failed!" -ForegroundColor Red
    exit 1
}

# Step 2: Run Verification Test Suites
Write-Host "`n[2/4] Executing automated verification tests..." -ForegroundColor Yellow
& node "$projectRoot\tests\test_uninstaller_core.js"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Automated tests failed!" -ForegroundColor Red
    exit 1
}

# Step 3: Package the desktop application.
# The MinGW toolchain location is only added when it actually exists; the MSVC
# toolchain (Visual Studio Build Tools) works without it.
Write-Host "`n[3/4] Compiling the Rust backend and packaging the desktop app..." -ForegroundColor Yellow
$gccBin = "C:\Users\hario\AppData\Local\Microsoft\WinGet\Packages\BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\mingw64\bin"
if (Test-Path $gccBin) {
    $env:Path = "$gccBin;$env:USERPROFILE\.cargo\bin;$env:Path"
}

& npm.cmd run tauri build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Tauri packaging failed, attempting standalone binary build..." -ForegroundColor DarkYellow
    & npm.cmd run tauri build -- --no-bundle
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Tauri build failed!" -ForegroundColor Red
        exit 1
    }
}

# Step 4: Refresh the standalone executable and installer in the repository root
Write-Host "`n[4/4] Refreshing standalone executable and setup installer..." -ForegroundColor Yellow
$candidates = @(
    (Join-Path $projectRoot "src-tauri\target\release\syntax-uninstaller.exe"),
    (Join-Path $projectRoot "src-tauri\target\x86_64-pc-windows-gnu\release\syntax-uninstaller.exe")
)
$builtExe = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($builtExe) {
    Copy-Item $builtExe (Join-Path $projectRoot "Syntax-Uninstaller.exe") -Force
    $sizeMb = [math]::Round((Get-Item $builtExe).Length / 1MB, 1)
    Write-Host "Copied $builtExe ($sizeMb MB) -> Syntax-Uninstaller.exe" -ForegroundColor Green
} else {
    Write-Host "Warning: no release executable was found to copy." -ForegroundColor DarkYellow
}

# Locate and copy NSIS setup installer if generated
$installerCandidates = Get-ChildItem -Path (Join-Path $projectRoot "src-tauri\target\release\bundle\nsis\*setup.exe") -ErrorAction SilentlyContinue
if ($installerCandidates) {
    $installerExe = $installerCandidates[0].FullName
    Copy-Item $installerExe (Join-Path $projectRoot "Syntax-Uninstaller-Setup.exe") -Force
    $installerSizeMb = [math]::Round((Get-Item $installerExe).Length / 1MB, 1)
    Write-Host "Copied $installerExe ($installerSizeMb MB) -> Syntax-Uninstaller-Setup.exe" -ForegroundColor Green
}


Write-Host "`nProduction build completed successfully!" -ForegroundColor Green
Write-Host "Artifacts: dist/ and src-tauri/target/release" -ForegroundColor Cyan
