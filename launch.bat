@echo off
setlocal
title Syntax Uninstaller Pro
cd /d "%~dp0"

set "PATH=C:\Windows\System32;C:\Windows;C:\Windows\System32\Wbem;C:\Windows\System32\WindowsPowerShell\v1.0\;C:\Users\hario\AppData\Local\Microsoft\WinGet\Packages\BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\mingw64\bin;C:\Users\hario\.cargo\bin;%PATH%"

start "" /d "%~dp0" "%~dp0Syntax-Uninstaller.exe"
exit /b 0
