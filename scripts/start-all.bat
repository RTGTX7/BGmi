@echo off
chcp 65001 >nul

:: BGmi 一键启动前后端

echo ============================================
echo           BGmi 快速启动
echo ============================================
echo.

:: 获取项目根目录（scripts 的父目录）
cd /d "%~dp0.."
set "PROJECT_ROOT=%cd%"
set "BGMI_ROOT=%PROJECT_ROOT%\BGmi"
set "FRONTEND_ROOT=%PROJECT_ROOT%\BGmi-frontend"

:: 检查后端虚拟环境
if not exist "%BGMI_ROOT%\.venv\Scripts\python.exe" (
    echo [!] 错误: 后端虚拟环境不存在
    echo     请先运行: scripts\dev-setup.ps1
    goto :error
)

:: 检查 pnpm
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] 错误: pnpm 未安装
    echo     请先运行: npm install -g pnpm
    goto :error
)

echo [1/2] 启动后端服务器...
start "BGmi Backend" cmd /k "cd /d %BGMI_ROOT% ^& .venv\Scripts\activate.bat ^& set BGMI_PATH=%%cd%%%%cd%%\.bgmi ^& set PYTHONIOENCODING=utf-8 ^& set BGMI_HTTP_SERVE_STATIC_FILES=false ^& python -m bgmi.front.server --port=8888 --address=127.0.0.1"
timeout /t 2 /nobreak >nul

echo [2/2] 启动前端开发服务器...
start "BGmi Frontend" cmd /k "cd /d %FRONTEND_ROOT% ^& set API_URL=http://127.0.0.1:8888 ^& pnpm dev --host 127.0.0.1 --port 5173"

echo.
echo ============================================
echo           启动完成！
echo ============================================
echo.
echo   后端: http://127.0.0.1:8888
echo   前端: http://127.0.0.1:5173
echo.
pause
goto :end

:error
echo.
pause

:end