# Changelog

## 2026-04-20 — RTGTX7 定制版 1.1.5

### Bangumi / Archive

- Split the Bangumi experience into a current-season homepage and a dedicated **Archive** page for historical seasonal groups.
- Refined Bangumi and Archive desktop poster grids so cards respond to available width and fill the main content area more naturally.
- Cleaned up the season headers by removing extra subtitle/sort controls and simplifying the entry flow into Archive.
- Added season detail-page polish and kept the quarter grouping aligned with the existing Mikan-derived season source.

### Subscribe Dashboard

- Added a dedicated **Dashboard** tab inside Subscribe with overview stats, diagnostics, and maintenance actions.
- Added Command Center actions for:
  - resyncing Mikan metadata
  - anomaly checks
  - repository rebuild preview / execute
  - episode progress reset
  - submit download jobs
  - refresh episodes and posters
- Improved Dashboard glassmorphism styling, status chips, and dark/light-mode readability.

### Mobile / Interaction

- Added swipe-based weekday switching improvements for Calendar / Subscribe tabs.
- Improved Subscribe mobile card/modal interactions and Bangumi mobile header/navigation details.
- Fixed the mobile player tap/long-press gesture split so tap toggles controls again while long-press 2x and Chrome context-menu blocking still work together.

## 2026-04-20

### Bangumi

- Reworked the Bangumi homepage into season-based groups driven by the existing Mikan cover season source.
- Added season detail pages and kept the grouping logic aligned with cover cache season paths.
- Improved desktop season-group responsiveness so cards reflow correctly when the browser window size changes.
- Fixed season cards stretching incorrectly when a group only contains a single title.
- Optimized mobile season detail pages for a proper two-column poster layout with larger cards.

### Player

- Fixed mobile Chrome long-press conflicts on the player so the custom 2x speed gesture is no longer hijacked by the browser video context menu.

### Dev / Preview

- Enabled Vite dev/preview LAN access for mobile-device testing.
- Bumped the custom release line to **RTGTX7 定制版 1.1.0**.

## 2026-04-09

### Subtitle Rendering

- Replaced JASSUB (libass WASM) with **ass.js** for ASS subtitle rendering — uses DOM-based rendering so CJK font fallback is handled natively by the browser, eliminating tofu boxes.
- Replaced native `<track>` WebVTT rendering with a **client-side SRT/VTT parser** + DOM overlay — fixes font size/position inconsistencies across screen sizes and fullscreen modes.
- Added support for both `HH:MM:SS.mmm` and short `MM:SS.mmm` timestamp formats (ffmpeg-extracted VTT files often omit hours).
- Added `paint-order: stroke fill` to subtitle text stroke to prevent glyph intersection artifacts on characters like "t".
- Removed ~64MB bundled CJK font files that were previously needed for JASSUB.

### Subtitle Selector

- Replaced `chakra-react-select` dropdown with Chakra UI native `<Select>` for the subtitle track picker — fixes "Maximum update depth exceeded" infinite re-render loop caused by `@floating-ui` `autoUpdate`.

### Docker

- Fixed `docker-entrypoint.sh` CRLF line endings that caused `exec: no such file or directory` on Linux containers.
- Added scheduled `bgmi update --download` every 30 minutes (configurable via `BGMI_UPDATE_INTERVAL`).
- Added scheduled `bgmi cal --force-update --download-cover` every 4 hours (configurable via `BGMI_CAL_INTERVAL`).
- Published Docker image to `rtgtx7/bgmi-custom:latest` on Docker Hub with full README overview.

### Mobile UI

- Polished episode card button sizing, gaps, padding, and rounded corners for mobile viewports.

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
