$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$upstreams = @(
    @{ Name = "upstream-bgmi"; Url = "https://github.com/BGmi/BGmi.git" },
    @{ Name = "upstream-docker"; Url = "https://github.com/codysk/bgmi-docker-all-in-one.git" }
)

foreach ($remote in $upstreams) {
    $exists = git -C $repoRoot remote | Where-Object { $_ -eq $remote.Name }
    if ($exists) {
        git -C $repoRoot remote set-url $remote.Name $remote.Url
    } else {
        git -C $repoRoot remote add $remote.Name $remote.Url
    }
}

git -C $repoRoot remote -v
