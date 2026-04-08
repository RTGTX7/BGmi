# RTGTX7 BGmi

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

### 1. 启动后端服务

```powershell
cd C:\Users\rtgtx\Desktop\bgmi\BGmi
.\run-local.ps1 http --port=8899 --address=127.0.0.1
```

### 2. 前端开发与构建

```powershell
cd C:\Users\rtgtx\Desktop\bgmi\BGmi-frontend
corepack pnpm install
corepack pnpm build
```

前端构建完成后，需要把 `dist` 覆盖到 `BGmi/.bgmi/front_static`。

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
