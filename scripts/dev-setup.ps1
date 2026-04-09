$ErrorActionPreference = "Stop"

$scriptsRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptsRoot
$backendRoot = Join-Path $projectRoot "BGmi"
$frontendRoot = Join-Path $projectRoot "BGmi-frontend"
$venvPython = Join-Path $backendRoot ".venv\Scripts\python.exe"

Write-Host "==> Preparing BGmi backend virtual environment"
if (-not (Test-Path $venvPython)) {
    python -m venv (Join-Path $backendRoot ".venv")
}

& $venvPython -m pip install --upgrade pip
Push-Location $backendRoot
try {
    & $venvPython -m pip install -e .
} finally {
    Pop-Location
}

Write-Host "==> Preparing BGmi frontend dependencies"
Push-Location $frontendRoot
try {
    $env:HUSKY = "0"
    corepack pnpm install
} finally {
    if (Test-Path Env:HUSKY) {
        Remove-Item Env:HUSKY
    }
    Pop-Location
}

Write-Host ""
Write-Host "Development environment is ready."
Write-Host "Backend:  powershell -ExecutionPolicy Bypass -File `"$scriptsRoot\dev-backend.ps1`""
Write-Host "Frontend: powershell -ExecutionPolicy Bypass -File `"$scriptsRoot\dev-frontend.ps1`""
