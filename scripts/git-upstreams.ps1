$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir

# 上游远程仓库说明：
#   upstream-bgmi   - BGmi 主项目 (https://github.com/BGmi/BGmi.git)
#   upstream-docker - Docker 配置模板 (https://github.com/codysk/bgmi-docker-all-in-one.git)
$upstreams = @(
    @{ Name = "upstream-bgmi"; Url = "https://github.com/BGmi/BGmi.git" },
    @{ Name = "upstream-docker"; Url = "https://github.com/codysk/bgmi-docker-all-in-one.git" }
)

function Setup-Remotes {
    Write-Host "配置上游远程仓库..." -ForegroundColor Cyan
    foreach ($upstream in $upstreams) {
        $exists = git -C $repoRoot remote | Where-Object { $_ -eq $upstream.Name }
        if ($exists) {
            git -C $repoRoot remote set-url $upstream.Name $upstream.Url
            Write-Host "  [✓] 更新 $($upstream.Name) -> $($upstream.Url)" -ForegroundColor Green
        } else {
            git -C $repoRoot remote add $upstream.Name $upstream.Url
            Write-Host "  [✓] 添加 $($upstream.Name) -> $($upstream.Url)" -ForegroundColor Green
        }
    }
    Write-Host ""
    git -C $repoRoot remote -v
}

function Fetch-Upstreams {
    Write-Host "拉取上游更新..." -ForegroundColor Cyan
    foreach ($upstream in $upstreams) {
        $exists = git -C $repoRoot remote | Where-Object { $_ -eq $upstream.Name }
        if ($exists) {
            git -C $repoRoot fetch $upstream.Name --prune
            Write-Host "  [✓] $($upstream.Name) 已同步" -ForegroundColor Green
        } else {
            Write-Host "  [!] $($upstream.Name) 未配置，请先运行: scripts\git-upstreams.ps1 setup" -ForegroundColor Yellow
        }
    }
}

# 主逻辑
if ($args.Count -eq 0) {
    Write-Host "用法:" -ForegroundColor Yellow
    Write-Host "  scripts\git-upstreams.ps1 setup   - 配置上游远程仓库" -ForegroundColor White
    Write-Host "  scripts\git-upstreams.ps1 fetch   - 拉取上游更新" -ForegroundColor White
    Write-Host ""
    exit 0
}

switch ($args[0].ToLower()) {
    "setup" {
        Setup-Remotes
    }
    "fetch" {
        Fetch-Upstreams
    }
    default {
        Write-Host "未知命令: $($args[0])" -ForegroundColor Red
        Write-Host "可用命令: setup, fetch" -ForegroundColor Yellow
        exit 1
    }
}