@echo off
powershell -WindowStyle Hidden -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force"
exit
