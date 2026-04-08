$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

git -C $repoRoot fetch upstream-bgmi --prune
git -C $repoRoot fetch upstream-docker --prune

Write-Output "Fetched upstream-bgmi and upstream-docker"
