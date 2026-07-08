# Step 3 — Local multi-container integration testing (PowerShell)
# Run from repository root:  .\scripts\step3-integration-test.ps1

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

Write-Host "`n=== Step 3.0 — Build & start stack ===" -ForegroundColor Cyan
docker compose build
docker compose up -d
Start-Sleep -Seconds 5
docker compose ps

Write-Host "`n=== Step 3.1 — HTTP health checks (host) ===" -ForegroundColor Cyan
@(
    @{ Name = "Node API";    Url = "http://localhost:5000/health" },
    @{ Name = "FastAPI AI";  Url = "http://localhost:8000/health" }
) | ForEach-Object {
    try {
        $r = Invoke-RestMethod -Uri $_.Url -TimeoutSec 15
        Write-Host "  OK $($_.Name): $($r | ConvertTo-Json -Compress)" -ForegroundColor Green
    } catch {
        Write-Host "  FAIL $($_.Name): $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== Step 3.2 — Mongo connectivity from node-backend ===" -ForegroundColor Cyan
docker compose exec -T node-backend node -e "
const u=process.env.MONGO_URI||process.env.MONGODB_URI;
fetch('http://fastapi-ai:8000/health').then(r=>r.json()).then(j=>console.log('AI:',JSON.stringify(j)));
console.log('MONGO_URI',u);
"

Write-Host "`n=== Step 3.3 — Docker socket diagnostic (inside node-backend) ===" -ForegroundColor Cyan
docker compose exec -T node-backend node scripts/docker-integration-diagnostic.js

Write-Host "`n=== Step 3.4 — Optional preview smoke (node-js static) ===" -ForegroundColor Cyan
Write-Host "  docker compose exec node-backend node scripts/docker-preview-smoke.js node-js"
Write-Host "  (Opens preview on host port — check console URL; stop container when done)"

Write-Host "`nDone. See STEP3 guide in assistant output for log signatures and cleanup." -ForegroundColor Cyan
