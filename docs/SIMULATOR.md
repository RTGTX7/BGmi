# BGmi 测试模拟器

模拟器使用独立的 `docker-simulator-data` 数据目录和 8898 端口，不会读取或修改生产 `docker-data`。

测试视频请放入独立目录 `docker-simulator-videos`。种子数据使用旧版目录布局，示例：

```text
docker-simulator-videos/
├─ Simulator New Anime/
│  ├─ 1/video.mp4
│  ├─ 2/video.mp4
│  └─ 3/video.mp4
└─ Simulator Archived Anime/
   └─ 1/video.mp4
```

支持常见视频扩展名，包括 `mp4`、`mkv`、`webm`、`mov` 和 `ts`。文件夹名称必须与种子番剧名称一致；每个数字目录代表集数。放入视频后刷新番剧或重新打开播放器即可扫描。

```powershell
./scripts/simulator.ps1 up
./scripts/simulator.ps1 status
./scripts/simulator.ps1 seed
```

打开 `http://127.0.0.1:8898/`，测试 Token 默认为 `simulator-token`。种子数据包含一部当季新番和一部归档旧番，可直接验证搜索、订阅、播放入口和归档分组。

调试接口仅在 `BGMI_SIMULATOR=1` 时存在：

- `GET /api/debug/status`
- `POST /api/debug/seed`，需要 `bgmi-token`
- `POST /api/debug/reset`，需要 `bgmi-token`

```powershell
./scripts/simulator.ps1 reset
./scripts/simulator.ps1 down
```
