# RTGTX7 BGmi

## 开发日志

- 2026-04-09：调整了 Bangumi 和 Subscribe 的移动端卡片布局，简化了底部快捷工具。
- 2026-04-09：修复了 Windows/Linux 路径归一化和容器内 GPU 探测。
- 2026-04-09：已推送 `main`，并将镜像发布到 `rtgtx7/bgmi-custom`。

基于官方 BGmi 二次开发的自用版本，重点增强了播放器、字幕和按需 HLS 播放链路，适合直接同步到 Linux 服务器继续部署。

## 当前特性

- DPlayer 播放器增强
- 默认自动挂载第一条字幕
- 多字幕提取与 WebVTT 转换
- 画质切换：`Direct Play`、`1080p HLS`、`1080p 5M`、`720p 3M`
- 按需 HLS 生成与 48 小时缓存清理
- NVIDIA GPU 优先转码
- 外部播放器拖拽链接

## 目录说明

- [BGmi](./BGmi)
  后端源码与服务端接口
- [BGmi-frontend](./BGmi-frontend)
  可编辑的前端源码工程
- `BGmi/.bgmi/front_static`
  前端构建后的运行目录

## 本地开发

现在仓库已经补了一套可热更新的开发环境，前后端可以分开跑，也可以一键拉起。

### 1. 初始化依赖

```powershell
cd C:\Users\rtgtx\Desktop\bgmi
powershell -ExecutionPolicy Bypass -File .\scripts\dev-setup.ps1
```

这一步会完成这些事情：

- 在 `BGmi/.venv` 创建 Python 虚拟环境
- 以可编辑模式安装后端 `BGmi`
- 通过 `corepack` 安装前端 `pnpm` 依赖

### 2. 启动开发环境

分别启动前后端：

```powershell
cd C:\Users\rtgtx\Desktop\bgmi
powershell -ExecutionPolicy Bypass -File .\scripts\dev-backend.ps1
```

```powershell
cd C:\Users\rtgtx\Desktop\bgmi
powershell -ExecutionPolicy Bypass -File .\scripts\dev-frontend.ps1
```

或者直接一键拉起两个窗口：

```powershell
cd C:\Users\rtgtx\Desktop\bgmi
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

### 3. 访问地址

- 前端开发页：`http://127.0.0.1:5173`
- 后端接口：`http://127.0.0.1:8888`

### 4. 热更新说明

- 前端修改后会通过 Vite HMR 立即生效
- 后端 Python 代码修改后会由 Tornado 调试模式自动重载
- 本地开发时前端会把 `/api`、`/bangumi`、`/resource` 代理到后端，不需要再手动复制 `dist` 到 `front_static`

## 常用播放说明

- `Direct Play`
  直接播放原始文件，最适合局域网或播放器兼容性好的场景
- `1080p HLS`
  原始流直接切片，生成速度快
- `1080p 5M`
  转码后的 1080p HLS 档位
- `720p 3M`
  转码后的低码率档位，适合弱网

## 字幕说明

- 页面默认使用第一条可用字幕
- 内嵌字幕会自动提取并转换成 `WebVTT`
- 多字幕会保留名称并在播放器菜单中切换

## GitHub 与长期维护

- 当前仓库是自定义维护版本，不再是纯官方镜像
- 官方后端 upstream 已建议作为独立远端跟踪
- 维护方式见：
  [MAINTENANCE.md](./MAINTENANCE.md)

## 后续部署方向

下一步建议基于这套源码做你自己的 Docker 构建层，而不是直接依赖原始公共镜像。这样播放器、字幕和 HLS 功能才能完整保留下来。
