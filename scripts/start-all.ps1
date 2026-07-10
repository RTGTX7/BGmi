$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

# 颜色配置
$green = [consolecolor]::Green
$yellow = [consolecolor]::Yellow
$cyan = [consolecolor]::Cyan
$white = [consolecolor]::White
$red = [consolecolor]::Red
$gray = [consolecolor]::DarkGray

function Write-Status {
    param([string]$Message, [consolecolor]$Color = $white)
    Write-Host $Message -ForegroundColor $Color
}

function Write-Separator {
    Write-Host "============================================" -ForegroundColor $cyan
}

function Write-Menu {
    Write-Separator
    Write-Host "           BGmi 开发环境管理" -ForegroundColor $cyan
    Write-Separator
    Write-Host ""
    Write-Host "  [1] 启动后端服务器" -ForegroundColor $green
    Write-Host "  [2] 启动前端开发服务器" -ForegroundColor $green
    Write-Host "  [3] 一键启动前后端" -ForegroundColor $green
    Write-Host ""
    Write-Host "  [4] 停止所有服务" -ForegroundColor $yellow
    Write-Host "  [5] 检查服务状态" -ForegroundColor $yellow
    Write-Host ""
    Write-Host "  [0] 退出" -ForegroundColor $gray
    Write-Host ""
    Write-Separator
}

function Check-BackendVenv {
    $venvPython = Join-Path $projectRoot "BGmi\.venv\Scripts\python.exe"
    return (Test-Path $venvPython)
}

function Check-Pnpm {
    try {
        pnpm --version > $null 2>&1
        return $true
    } catch {
        return $false
    }
}

function Start-Backend {
    Write-Host ""
    Write-Host "[1/1] 启动后端服务器..." -ForegroundColor $green
    
    $venvPython = Join-Path $projectRoot "BGmi\.venv\Scripts\python.exe"
    $bgmiPath = Join-Path $projectRoot "BGmi\.bgmi"
    
    if (-not (Check-BackendVenv)) {
        Write-Host "  [!] 错误: 后端虚拟环境不存在" -ForegroundColor $red
        Write-Host "  请先运行: scripts\dev-setup.ps1" -ForegroundColor $yellow
        return $false
    }
    
    $proc = Start-Process pwsh -ArgumentList @(
        "-NoExit",
        "-Command",
        "`$env:BGMI_PATH='$bgmiPath'; " +
        "`$env:PYTHONIOENCODING='utf-8'; " +
        "`$env:BGMI_HTTP_SERVE_STATIC_FILES='false'; " +
        "& '$venvPython' -m bgmi.front.server --port=8888 --address=127.0.0.1"
    ) -PassThru
    
    Start-Sleep -Seconds 2
    Write-Host "  [✓] 后端已启动: http://127.0.0.1:8888" -ForegroundColor $green
    return $true
}

function Start-Frontend {
    Write-Host ""
    Write-Host "[2/2] 启动前端开发服务器..." -ForegroundColor $green
    
    $frontendRoot = Join-Path $projectRoot "BGmi-frontend"
    
    if (-not (Check-Pnpm)) {
        Write-Host "  [!] 错误: pnpm 未安装" -ForegroundColor $red
        Write-Host "  请先运行: npm install -g pnpm" -ForegroundColor $yellow
        return $false
    }
    
    if (-not (Test-Path $frontendRoot)) {
        Write-Host "  [!] 错误: 前端目录不存在: $frontendRoot" -ForegroundColor $red
        return $false
    }
    
    $proc = Start-Process pwsh -ArgumentList @(
        "-NoExit",
        "-Command",
        "`$env:API_URL='http://127.0.0.1:8888'; " +
        "Set-Location '$frontendRoot'; " +
        "corepack pnpm dev --host 127.0.0.1 --port 5173"
    ) -PassThru
    
    Start-Sleep -Seconds 3
    Write-Host "  [✓] 前端已启动: http://127.0.0.1:5173" -ForegroundColor $green
    return $true
}

function Start-All {
    Write-Host ""
    Write-Separator
    Write-Host "  正在启动开发环境..." -ForegroundColor $cyan
    Write-Separator
    Write-Host ""
    
    $backendOk = $true
    $frontendOk = $true
    
    # 检查前置条件
    $checks = @()
    if (-not (Check-BackendVenv)) {
        $checks += "后端虚拟环境 (.venv) 不存在，请先运行 scripts\dev-setup.ps1"
        $backendOk = $false
    }
    if (-not (Check-Pnpm)) {
        $checks += "pnpm 未安装，请先运行 npm install -g pnpm"
        $frontendOk = $false
    }
    
    if ($checks.Count -gt 0) {
        Write-Host "  前置检查失败:" -ForegroundColor $red
        foreach ($check in $checks) {
            Write-Host "    - $check" -ForegroundColor $yellow
        }
        Write-Host ""
        return $false
    }
    
    # 启动后端
    Start-Backend
    
    # 启动前端
    Start-Frontend
    
    Write-Host ""
    Write-Separator
    Write-Host "  启动完成！" -ForegroundColor $green
    Write-Separator
    Write-Host ""
    Write-Host "  后端: http://127.0.0.1:8888" -ForegroundColor $white
    Write-Host "  前端: http://127.0.0.1:5173" -ForegroundColor $white
    Write-Host ""
    Write-Host "  提示:" -ForegroundColor $cyan
    Write-Host "    - 两个终端窗口已自动打开" -ForegroundColor $gray
    Write-Host "    - 后端支持代码热重载 (Tornado debug mode)" -ForegroundColor $gray
    Write-Host "    - 前端支持 HMR 热更新" -ForegroundColor $gray
    Write-Host "    - 按 Ctrl+C 可停止对应服务" -ForegroundColor $gray
    Write-Host "    - 运行 scripts\stop-all.ps1 停止所有服务" -ForegroundColor $gray
    Write-Host ""
    
    return ($backendOk -and $frontendOk)
}

function Stop-All {
    Write-Host ""
    Write-Separator
    Write-Host "  正在停止所有服务..." -ForegroundColor $yellow
    Write-Separator
    Write-Host ""
    
    $stopped = $false
    
    # 停止 Python 进程 (后端)
    $pythonProcesses = Get-Process -Name python -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -like "*bgmi.front.server*" -or $_.CommandLine -like "*bgmi*"
    }
    
    if ($pythonProcesses) {
        $pythonProcesses | Stop-Process -Force
        Write-Host "  [✓] 已停止后端进程" -ForegroundColor $green
        $stopped = $true
    } else {
        Write-Host "  [!] 后端未在运行" -ForegroundColor $gray
    }
    
    # 停止 pnpm/vite 进程
    $viteProcesses = Get-Process -Name pwsh -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -like "*vite*" -or $_.CommandLine -like "*pnpm dev*"
    }
    
    if ($viteProcesses) {
        $viteProcesses | Stop-Process -Force
        Write-Host "  [✓] 已停止前端进程" -ForegroundColor $green
        $stopped = $true
    } else {
        Write-Host "  [!] 前端未在运行" -ForegroundColor $gray
    }
    
    # 通过端口检查
    $bgmiBackend = Get-NetTCPConnection -LocalPort 8888 -ErrorAction SilentlyContinue
    if ($bgmiBackend) {
        $processId = $bgmiBackend.OwningProcess
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        Write-Host "  [✓] 已停止 8888 端口进程" -ForegroundColor $green
        $stopped = $true
    }
    
    $bgmiFrontend = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
    if ($bgmiFrontend) {
        $processId = $bgmiFrontend.OwningProcess
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        Write-Host "  [✓] 已停止 5173 端口进程" -ForegroundColor $green
        $stopped = $true
    }
    
    if (-not $stopped) {
        Write-Host "  [!] 未发现运行的服务" -ForegroundColor $gray
    }
    
    Write-Host ""
    Write-Host "  [✓] 服务清理完成" -ForegroundColor $green
    Write-Host ""
}

function Check-Status {
    Write-Host ""
    Write-Separator
    Write-Host "  服务状态检查" -ForegroundColor $cyan
    Write-Separator
    Write-Host ""
    
    # 检查后端
    $backendConn = Get-NetTCPConnection -LocalPort 8888 -ErrorAction SilentlyContinue
    if ($backendConn) {
        $state = $backendConn.TcpState
        Write-Host "  后端 (8888): " -NoNewline -ForegroundColor $white
        if ($state -eq "Listen") {
            Write-Host "运行中" -ForegroundColor $green
        } else {
            Write-Host "异常 ($state)" -ForegroundColor $yellow
        }
    } else {
        Write-Host "  后端 (8888): " -NoNewline -ForegroundColor $white
        Write-Host "未运行" -ForegroundColor $gray
    }
    
    # 检查前端
    $frontendConn = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
    if ($frontendConn) {
        $state = $frontendConn.TcpState
        Write-Host "  前端 (5173): " -NoNewline -ForegroundColor $white
        if ($state -eq "Listen") {
            Write-Host "运行中" -ForegroundColor $green
        } else {
            Write-Host "异常 ($state)" -ForegroundColor $yellow
        }
    } else {
        Write-Host "  前端 (5173): " -NoNewline -ForegroundColor $white
        Write-Host "未运行" -ForegroundColor $gray
    }
    
    Write-Host ""
    
    # 检查依赖
    Write-Host "  依赖检查:" -ForegroundColor $cyan
    if (Check-BackendVenv) {
        Write-Host "    后端虚拟环境: " -NoNewline -ForegroundColor $white
        Write-Host "就绪" -ForegroundColor $green
    } else {
        Write-Host "    后端虚拟环境: " -NoNewline -ForegroundColor $white
        Write-Host "缺失" -ForegroundColor $red
    }
    
    if (Check-Pnpm) {
        $pnpmVer = pnpm --version
        Write-Host "    pnpm: " -NoNewline -ForegroundColor $white
        Write-Host "已安装 (v$pnpmVer)" -ForegroundColor $green
    } else {
        Write-Host "    pnpm: " -NoNewline -ForegroundColor $white
        Write-Host "未安装" -ForegroundColor $red
    }
    
    Write-Host ""
}

# 主循环
$running = $true
while ($running) {
    Clear-Host
    Write-Menu
    $choice = Read-Host "请选择操作"
    
    switch ($choice) {
        "1" {
            Clear-Host
            Start-Backend
            Read-Host "`n按回车键返回菜单"
        }
        "2" {
            Clear-Host
            Start-Frontend
            Read-Host "`n按回车键返回菜单"
        }
        "3" {
            Clear-Host
            Start-All
            Read-Host "`n按回车键返回菜单"
        }
        "4" {
            Clear-Host
            Stop-All
            Read-Host "`n按回车键返回菜单"
        }
        "5" {
            Clear-Host
            Check-Status
            Read-Host "`n按回车键返回菜单"
        }
        "0" {
            $running = $false
        }
        default {
            Clear-Host
            Write-Host "  [!] 无效选项，请重新选择" -ForegroundColor $red
            Start-Sleep -Seconds 1
        }
    }
}

Clear-Host
Write-Host "  再见！" -ForegroundColor $gray
Write-Host ""