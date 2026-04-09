$ErrorActionPreference = "Stop"

$scriptsRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptsRoot
$frontendRoot = Join-Path $projectRoot "BGmi-frontend"

$env:API_URL = "http://127.0.0.1:8888"

Write-Host "Starting BGmi frontend on http://127.0.0.1:5173"
Write-Host "Frontend changes will hot-update through Vite HMR."

Push-Location $frontendRoot
try {
    corepack pnpm dev --host 127.0.0.1 --port 5173
} finally {
    Pop-Location
}
