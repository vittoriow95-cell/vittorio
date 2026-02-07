$workingDir = "C:\Users\vitto\Desktop\HACCP_APP"
$logPath = Join-Path $workingDir "r2_upload_test.log"

function LogLine($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$ts $msg" | Add-Content -Path $logPath -Encoding UTF8
}

# 1x1 PNG trasparente
$base64Png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
$dataUrl = "data:image/png;base64,$base64Png"

$body = @{ tipo = "ingrediente"; dataUrl = $dataUrl } | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:5000/api/upload-foto" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 10
    $url = $response.url
    if ($response.success -and $url) {
        LogLine "OK upload test. URL: $url"
    } else {
        LogLine "KO upload test. Response: $($response | ConvertTo-Json -Compress)"
    }
} catch {
    LogLine "Errore upload test: $($_.Exception.Message)"
}
