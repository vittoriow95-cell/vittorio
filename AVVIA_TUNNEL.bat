@echo off
setlocal

set "CLOUDFLARED_EXE=C:\Program Files (x86)\cloudflared\cloudflared.exe"
set "TUNNEL_OUT=%~dp0tunnel_output.txt"
set "TUNNEL_ERR=%~dp0tunnel_error.txt"

if not exist "%CLOUDFLARED_EXE%" (
    echo cloudflared.exe non trovato: %CLOUDFLARED_EXE%
    exit /b 1
)

start "" /B cmd /c ""%CLOUDFLARED_EXE%" tunnel --url http://localhost:7002 --no-autoupdate 1> "%TUNNEL_OUT%" 2> "%TUNNEL_ERR%""

endlocal
