@echo off
setlocal

netsh advfirewall firewall add rule name="HACCP Server 5000" dir=in action=allow protocol=TCP localport=5000
netsh advfirewall firewall add rule name="HACCP Print Agent 7002" dir=in action=allow protocol=TCP localport=7002

echo Regole firewall create. Eseguire come amministratore.
pause
