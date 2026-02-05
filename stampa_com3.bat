@echo off
REM Stampa etichetta su COM3
copy /b etichetta_temp.prn \\.\COM3 > nul 2>&1
