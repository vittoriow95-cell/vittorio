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

echo [2/4] Avvio server in background...
start /B "" node server.js

echo [3/4] Attesa avvio server...
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

echo [4/4] Avvio print-agent in background...
start /B "" node print-agent.js

timeout /t 2 /nobreak >nul
powershell -Command "$test = Test-NetConnection -ComputerName localhost -Port 7002 -InformationLevel Quiet -WarningAction SilentlyContinue; if ($test) { exit 0 } else { exit 1 }" >nul 2>&1

if %errorlevel% neq 0 (
    echo.
    echo [ATTENZIONE] Print-agent non avviato sulla porta 7002.
    echo La stampa potrebbe non funzionare finche' non si avvia.
)

echo.
echo ========================================
echo   SERVER ATTIVO
echo ========================================
echo.
echo ^> URL: http://localhost:5000
echo ^> Stampante: 4BARCODE 4B-2054L(BT)
echo ^> Print-agent: http://localhost:7002
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
