# BGmi 开发脚本

## 快速开始

### 方式一：CMD (.bat) - 推荐新手
```cmd
:: 1. 进入开发环境
scripts\enter-env.bat

:: 2. 一键启动前后端
scripts\start-all.bat
```

### 方式二：PowerShell (.ps1)
```powershell
# 1. 设置开发环境
.\scripts\dev-setup.ps1

# 2. 一键启动前后端
.\scripts\start-all.ps1
```

## 脚本列表

### 环境设置

| 脚本 | 说明 |
|------|------|
| `dev-setup.ps1` | 创建虚拟环境、安装前后端依赖 (PowerShell) |
| `enter-env.bat` | 进入开发环境（激活虚拟环境）(CMD) |

### 开发运行

| 脚本 | 说明 |
|------|------|
| `start-all.bat` | 一键启动前后端 (CMD) |
| `start-all.ps1` | 交互式菜单管理（启动/停止/状态检查）(PowerShell) |
| `dev.ps1` | 一键启动前后端 (PowerShell) |
| `dev-backend.ps1` | 单独启动后端 (8888) (PowerShell) |
| `dev-frontend.ps1` | 单独启动前端 (5173) (PowerShell) |

### Git 工具

| 脚本 | 说明 |
|------|------|
| `git-upstreams.ps1` | 管理上游远程仓库 |

```powershell
# 配置上游远程
.\scripts\git-upstreams.ps1 setup

# 拉取上游更新
.\scripts\git-upstreams.ps1 fetch
```

## 端口说明

| 端口 | 服务 |
|------|------|
| 8888 | 后端 API 服务器 |
| 5173 | 前端开发服务器 (Vite) |