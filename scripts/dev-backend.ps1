$ErrorActionPreference = "Stop"

$scriptsRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptsRoot
$backendRoot = Join-Path $projectRoot "BGmi"
$venvPython = Join-Path $backendRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    throw "Backend virtual environment not found. Run scripts/dev-setup.ps1 first."
}

$env:BGMI_PATH = Join-Path $backendRoot ".bgmi"
$env:PYTHONIOENCODING = "utf-8"
$env:BGMI_HTTP_SERVE_STATIC_FILES = "false"

Write-Host "Starting BGmi backend on http://127.0.0.1:8888"
Write-Host "Code changes will be auto-reloaded by Tornado debug mode."

& $venvPython -m bgmi.front.server --port=8888 --address=127.0.0.1
