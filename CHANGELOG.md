# Changelog

## 2026-04-08

### Player

- Reworked the web player flow around DPlayer instead of ArtPlayer.
- Added quality presets in the player UI:
  - `Direct Play`
  - `1080p HLS`
  - `1080p 5M`
  - `720p 3M`
- Reordered the quality buttons to match the expected playback priority.
- Tightened the button spacing for a cleaner player toolbar layout.
- Updated the "copy player link" behavior to use the currently active playback URL instead of always using the raw source file URL.
- Added a draggable link card in the external-player modal so the active playback URL can be dragged directly into `mpv`.
- Removed the extra subtitle hint text under the player.

### Subtitle Support

- Enabled automatic subtitle mounting in the web player.
- Default playback now loads the first available subtitle track automatically.
- Added support for multiple subtitle tracks exposed from backend metadata.
- Embedded subtitles are extracted and converted to WebVTT for DPlayer compatibility.
- Generated subtitle files are saved alongside the episode files instead of being hidden in a temporary video cache directory.

### HLS Pipeline

- Added on-demand HLS generation profiles:
  - `720p` at `3M`
  - `1080p` at `5M`
  - `1080p_TS` in copy/direct-segment mode
- Added frontend progress display for HLS generation jobs.
- Added backend HLS job status/start APIs for progress polling.
- Added 48-hour HLS cache cleanup support through config.
- Fixed HLS command generation so ffmpeg output parameters are ordered correctly.
- Fixed GPU HLS generation to prefer NVIDIA acceleration instead of incorrectly dropping into CPU fallback.
- Verified `720p` now reports `gpu-transcode`.
- Verified `1080p_TS` can complete quickly through direct segmentation mode.

### Backend

- Added player asset generation helpers for browser playback, subtitles, and HLS quality metadata.
- Extended config handling to support player/HLS settings.
- Added API routes for player assets and HLS task lifecycle management.
- Kept direct-play mode available for original source files.

### Frontend Source

- Added the full `BGmi-frontend` source tree to this repository for continued customization and Linux deployment.
- Updated the player page and related hooks/types to support:
  - current-source playback switching
  - HLS generation progress polling
  - subtitle default selection
  - custom external-player behavior

### Docker And Deployment

- Added/updated local Docker-related files under `BGmi/` for containerized deployment experiments.
- Prepared the repository so the customized backend and frontend sources can be used as the basis for a Linux server build and a custom Docker image later.

### Repository Layout

- Converted the previously nested `BGmi` gitlink into real source files inside this repository.
- Added the frontend source as real files instead of leaving it as a nested repository pointer.
- Updated `.gitignore` to exclude local-only directories such as `_refs`, `BGmi/.bgmi`, `BGmi-frontend/node_modules`, and `BGmi-frontend/dist`.
