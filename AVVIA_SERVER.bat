@echo off
title SERVER HACCP - Porta 5000
echo.
echo ========================================
echo   AVVIO SERVER HACCP
echo ========================================
echo.

echo [1/4] Chiudo processi Node.js esistenti...
taskkill /F /IM node.exe >nul 2>&1

echo [2/4] Libero la porta 5000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000') do taskkill /F /PID %%a >nul 2>&1

echo [3/4] Attendo 3 secondi...
timeout /t 3 /nobreak >nul

echo [4/4] Avvio server sulla porta 5000...
echo.
node server.js

if errorlevel 1 (
    echo.
    echo ==========================================
    echo   ERRORE - Server non avviato
    echo ==========================================
    echo.
)

pause
