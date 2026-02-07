@echo off
setlocal

:: Avvio automatico server + print-agent (senza interazione)
set "NODE_EXE=C:\Program Files\nodejs\node.exe"

:: Carica variabili R2 locali se presenti (non versionate)
if exist "%~dp0R2_ENV.bat" call "%~dp0R2_ENV.bat"

powershell -Command "$s = Test-NetConnection -ComputerName localhost -Port 5000 -InformationLevel Quiet -WarningAction SilentlyContinue; if (-not $s) { Start-Process -WindowStyle Hidden -FilePath '%NODE_EXE%' -ArgumentList 'server.js' }" >nul 2>&1

powershell -Command "$p = Test-NetConnection -ComputerName localhost -Port 7002 -InformationLevel Quiet -WarningAction SilentlyContinue; if (-not $p) { Start-Process -WindowStyle Hidden -FilePath '%NODE_EXE%' -ArgumentList 'print-agent.js' }" >nul 2>&1

:: Avvio tunnel cloudflared per stampa remota
start "" /B "%~dp0AVVIA_TUNNEL.bat"

:: Watchdog tunnel (riavvio automatico se cade)
powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0TUNNEL_WATCHDOG.ps1" >nul 2>&1

:: Watchdog server + print-agent (riavvio automatico)
powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0HACCP_WATCHDOG.ps1" >nul 2>&1

:: Test automatico upload R2 (una volta)
powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0R2_TEST_UPLOAD.ps1" >nul 2>&1

:: Apri app locale
start http://localhost:5000

endlocal
