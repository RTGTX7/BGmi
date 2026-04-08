$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$venvPython = Join-Path $projectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    throw "Virtual environment not found. Run: python -m venv .venv"
}

$env:BGMI_PATH = Join-Path $projectRoot ".bgmi"
$env:PYTHONIOENCODING = "utf-8"
if ($env:DEBUG) {
    Remove-Item Env:DEBUG
}

if ($args.Count -eq 0) {
    & $venvPython -m bgmi --help
    exit $LASTEXITCODE
}

if ($args[0] -eq "http") {
    $httpArgs = @("-m", "bgmi.front.server") + $args[1..($args.Count - 1)]
    & $venvPython @httpArgs
    exit $LASTEXITCODE
}

$cliArgs = @("-m", "bgmi") + $args
& $venvPython @cliArgs
exit $LASTEXITCODE
