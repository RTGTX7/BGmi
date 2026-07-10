@echo off

:: BGmi 开发环境进入脚本
:: 激活虚拟环境并打开 CMD 窗口

echo ============================================
echo        BGmi 开发环境进入
echo ============================================
echo.

:: 获取项目根目录（scripts 的父目录）
cd /d "%~dp0.."
set "PROJECT_ROOT=%cd%"
set "BGMI_ROOT=%PROJECT_ROOT%\BGmi"

:: 检查虚拟环境
if not exist "%BGMI_ROOT%\.venv\Scripts\python.exe" (
    echo [!] 错误: 后端虚拟环境不存在
    echo     请先运行: scripts\dev-setup.ps1
    echo     或运行: python -m venv BGmi\.venv
    echo.
    pause
    exit /b 1
)

:: 进入 BGmi 目录
cd /d "%BGMI_ROOT%"

echo [1/2] 激活 Python 虚拟环境...
call .venv\Scripts\activate.bat

echo [2/2] 设置环境变量...
set BGMI_PATH=%cd%\.bgmi
set PYTHONIOENCODING=utf-8
set BGMI_HTTP_SERVE_STATIC_FILES=false

echo.
echo ============================================
echo        环境已就绪！
echo ============================================
echo.
echo   BGMI_PATH: %BGMI_PATH%
echo.
echo   可用命令:
echo     bgmi --help          - 查看 BGmi 命令
echo     bgmi database sync   - 同步数据库
echo     bgmi download all    - 下载所有订阅
echo.
echo   启动前端:
echo     cd ..\BGmi-frontend
echo     pnpm dev
echo.
echo   退出环境:
echo     deactivate
echo.
echo ============================================
echo.

:: 保持窗口打开
cmd /k @echo Development environment ready! Type ^"bgmi --help^" for commands. Type ^"deactivate^" to exit.