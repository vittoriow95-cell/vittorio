$cloudflared = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
$workingDir = "C:\Users\vitto\Desktop\HACCP_APP"
$tunnelOut = Join-Path $workingDir "tunnel_output.txt"
$tunnelErr = Join-Path $workingDir "tunnel_error.txt"

while ($true) {
    $running = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
    if (-not $running) {
        Start-Process -WindowStyle Hidden -FilePath $cloudflared -ArgumentList "tunnel --url http://localhost:7002 --no-autoupdate" -WorkingDirectory $workingDir -RedirectStandardOutput $tunnelOut -RedirectStandardError $tunnelErr
    }
    Start-Sleep -Seconds 30
}
