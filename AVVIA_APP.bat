@echo off
title HACCP SYSTEM - Server Attivo
color 0A

echo.
echo ========================================
echo   HACCP SYSTEM - AVVIO AUTOMATICO
echo ========================================
echo.

:: Controlla se il server è già attivo
powershell -Command "$test = Test-NetConnection -ComputerName localhost -Port 5000 -InformationLevel Quiet -WarningAction SilentlyContinue; if ($test) { exit 0 } else { exit 1 }" >nul 2>&1

if %errorlevel% equ 0 (
    echo [OK] Server gia attivo sulla porta 5000
    echo.
    echo Apertura browser...
    timeout /t 1 /nobreak >nul
    start http://localhost:5000
    echo.
    echo ========================================
    echo   APP GIA AVVIATA
    echo ========================================
    echo.
    timeout /t 3 /nobreak >nul
    exit
)

echo [1/3] Pulizia porte...
powershell -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue" >nul 2>&1

echo [2/3] Avvio server in background...
start /B "" node server.js

echo [3/3] Attesa avvio server...
timeout /t 3 /nobreak >nul

:: Verifica che il server sia partito
powershell -Command "$test = Test-NetConnection -ComputerName localhost -Port 5000 -InformationLevel Quiet -WarningAction SilentlyContinue; if ($test) { exit 0 } else { exit 1 }" >nul 2>&1

if %errorlevel% neq 0 (
    echo.
    echo [ERRORE] Server non avviato!
    echo Premere un tasto per uscire...
    pause >nul
    exit /b 1
)

echo.
echo ========================================
echo   SERVER ATTIVO
echo ========================================
echo.
echo ^> URL: http://localhost:5000
echo ^> Stampante: 4BARCODE 4B-2054L(BT)
echo ^> Gestione PEC: Attiva
echo.
echo ATTENZIONE: NON CHIUDERE QUESTA FINESTRA!
echo Il server rimane attivo in background.
echo.
echo Per chiudere l'applicazione:
echo - Chiudi questa finestra
echo - Oppure chiudi il browser
echo.
echo ========================================

:: Apri browser automaticamente
start http://localhost:5000

echo.
echo Premi un tasto per terminare il server...
pause >nul

:: Chiudi il server quando l'utente chiude la finestra
echo.
echo Chiusura server...
powershell -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue" >nul 2>&1
echo Server terminato.
timeout /t 2 /nobreak >nul
