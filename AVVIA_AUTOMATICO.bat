@echo off
setlocal

:: Avvio automatico server + print-agent (senza interazione)

powershell -Command "$s = Test-NetConnection -ComputerName localhost -Port 5000 -InformationLevel Quiet -WarningAction SilentlyContinue; if (-not $s) { Start-Process -WindowStyle Hidden -FilePath 'node' -ArgumentList 'server.js' }" >nul 2>&1

powershell -Command "$p = Test-NetConnection -ComputerName localhost -Port 7002 -InformationLevel Quiet -WarningAction SilentlyContinue; if (-not $p) { Start-Process -WindowStyle Hidden -FilePath 'node' -ArgumentList 'print-agent.js' }" >nul 2>&1

:: Avvio tunnel cloudflared per stampa remota
start "" /B "%~dp0AVVIA_TUNNEL.bat"

:: Apri app locale
start http://localhost:5000

endlocal
