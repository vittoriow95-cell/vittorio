@echo off
setlocal
cd /d "%~dp0"

call :startIfFree 5000 server.js
call :startIfFree 7002 print-agent.js

exit /b 0

:startIfFree
set PORT=%~1
set SCRIPT=%~2

powershell -NoProfile -Command "if (Test-NetConnection -ComputerName 127.0.0.1 -Port %PORT% -InformationLevel Quiet) { exit 0 } else { exit 1 }"
if %errorlevel%==0 exit /b 0

start "" /B node "%SCRIPT%"
exit /b 0
