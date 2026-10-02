# BGmi 测试模拟器

模拟器使用独立的 `docker-simulator-data` 数据目录和 8898 端口，不会读取或修改生产 `docker-data`。

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
