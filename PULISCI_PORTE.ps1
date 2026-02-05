# =====================================================
# SCRIPT PULIZIA PORTE E PROCESSI NODE.JS
# Libera tutte le porte occupate da processi zombie
# =====================================================

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   PULIZIA PORTE - HACCP APP" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Termina tutti i processi Node.js
Write-Host "[1/3] Terminazione processi Node.js..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | ForEach-Object {
        Write-Host "  - Terminazione processo PID: $($_.Id)" -ForegroundColor Gray
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "  OK - Terminati $($nodeProcesses.Count) processi Node.js" -ForegroundColor Green
} else {
    Write-Host "  OK - Nessun processo Node.js attivo" -ForegroundColor Green
}

# 2. Libera le porte comuni (3000, 3001, 5000, 8080)
Write-Host ""
Write-Host "[2/3] Liberazione porte..." -ForegroundColor Yellow
$porte = @(3000, 3001, 5000, 8080)

foreach ($porta in $porte) {
    try {
        $connections = Get-NetTCPConnection -LocalPort $porta -ErrorAction SilentlyContinue
        if ($connections) {
            $processes = $connections | Select-Object -ExpandProperty OwningProcess -Unique
            foreach ($pid in $processes) {
                $processName = (Get-Process -Id $pid -ErrorAction SilentlyContinue).ProcessName
                Write-Host "  - Liberazione porta ${porta} (PID: $pid - $processName)" -ForegroundColor Gray
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            }
            Write-Host "  OK - Porta $porta liberata" -ForegroundColor Green
        } else {
            Write-Host "  OK - Porta $porta gia libera" -ForegroundColor Green
        }
    } catch {
        Write-Host "  - Porta $porta non in uso" -ForegroundColor Gray
    }
}

# 3. Verifica finale
Write-Host ""
Write-Host "[3/3] Verifica finale..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

$nodeCheck = Get-Process -Name node -ErrorAction SilentlyContinue
$porteOccupate = @()

foreach ($porta in $porte) {
    if (Get-NetTCPConnection -LocalPort $porta -ErrorAction SilentlyContinue) {
        $porteOccupate += $porta
    }
}

Write-Host ""
if (-not $nodeCheck -and $porteOccupate.Count -eq 0) {
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "   OK - PULIZIA COMPLETATA CON SUCCESSO" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Puoi ora avviare il server con AVVIA_SERVER.bat" -ForegroundColor Cyan
} else {
    Write-Host "================================================" -ForegroundColor Red
    Write-Host "   ATTENZIONE" -ForegroundColor Red
    Write-Host "================================================" -ForegroundColor Red
    Write-Host ""
    
    if ($nodeCheck) {
        Write-Host "Processi Node.js ancora attivi: $($nodeCheck.Count)" -ForegroundColor Yellow
    }
    
    if ($porteOccupate.Count -gt 0) {
        Write-Host "Porte ancora occupate: $($porteOccupate -join ', ')" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Prova a riavviare il computer se il problema persiste." -ForegroundColor Yellow
}

Write-Host ""
pause
