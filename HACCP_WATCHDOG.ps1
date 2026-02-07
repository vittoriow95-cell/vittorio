$workingDir = "C:\Users\vitto\Desktop\HACCP_APP"
$nodeExe = "C:\Program Files\nodejs\node.exe"
$logPath = Join-Path $workingDir "haccp_watchdog.log"

function LogLine($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$ts $msg" | Add-Content -Path $logPath -Encoding UTF8
}

if (-not (Test-Path $nodeExe)) {
    LogLine "Node.exe non trovato: $nodeExe"
    exit 1
}

while ($true) {
    try {
        $serverUp = Test-NetConnection -ComputerName "localhost" -Port 5000 -InformationLevel Quiet -WarningAction SilentlyContinue
        if (-not $serverUp) {
            LogLine "Server 5000 offline. Avvio server.js"
            Start-Process -WindowStyle Hidden -FilePath $nodeExe -ArgumentList "server.js" -WorkingDirectory $workingDir
        }

        $agentUp = Test-NetConnection -ComputerName "localhost" -Port 7002 -InformationLevel Quiet -WarningAction SilentlyContinue
        if (-not $agentUp) {
            LogLine "Print-agent 7002 offline. Avvio print-agent.js"
            Start-Process -WindowStyle Hidden -FilePath $nodeExe -ArgumentList "print-agent.js" -WorkingDirectory $workingDir
        }
    } catch {
        LogLine "Errore watchdog: $($_.Exception.Message)"
    }

    Start-Sleep -Seconds 20
}
