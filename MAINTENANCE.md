# Maintenance Guide

## Repository Layout

- `BGmi/`
  Customized BGmi backend source based on the official upstream project.
- `BGmi-frontend/`
  Editable frontend source used to build the player/admin UI.
- `_refs/`
  Local reference clones only. This directory is ignored and must not be deployed.

## Long-Term Maintenance Strategy

This repository is now a customized fork workspace, not a pure mirror of the official project.

Recommended rule:

1. Treat `origin/main` as your deployable source of truth.
2. Track official upstream changes separately.
3. Port upstream fixes into `BGmi/` deliberately instead of blindly overwriting files.
4. Keep Docker customization as an outer deployment layer so backend/player logic stays easier to merge.

## Recommended Git Remotes

- `origin`
  Your own GitHub repository.
- `upstream-bgmi`
  Official BGmi backend repository.
- `upstream-docker`
  Official all-in-one Docker wrapper repository.

## Recommended Branch Model

- `main`
  Stable deployable branch for your Linux server.
- `feature/*`
  Temporary work branches for player/HLS/subtitle changes.
- Optional local tracking branches:
  - `tracking/upstream-bgmi-main`
  - `tracking/upstream-docker-main`

## Update Workflow

When official BGmi changes:

1. Fetch upstream refs.
2. Review backend changes from `upstream-bgmi/main`.
3. Port only the needed updates into `BGmi/`.
4. Rebuild frontend if player APIs or UI behavior changed.
5. Test:
  - direct play
  - subtitle default load
  - HLS 720p / 1080p / 1080p_TS
  - external-player drag link
6. Commit and push to `origin/main`.

## Docker Strategy

For Linux deployment, do not depend on the original public image as-is.

Recommended approach:

1. Use this repo as the customized source repository.
2. Build a derived Docker source layer that:
  - installs `BGmi/`
  - builds `BGmi-frontend/`
  - copies the built frontend into the runtime image
  - preserves your config and HLS customizations
3. Publish your own image tag.

## Important Notes

- `bgmi install` downloads frontend release artifacts from npm. It does not rebuild the editable frontend source in `BGmi-frontend/`.
- Runtime frontend assets under `BGmi/.bgmi/front_static/` are build outputs, not the authoritative source.
- Always keep `_refs/`, `node_modules/`, and `dist/` out of Git and out of deployment artifacts.
