# BGmi 5.0.2 integration plan

## Scope and baseline

- Personal baseline: `origin/main` at `2d0629b` (2026-07-10), with a customized BGmi 4.5.2 backend, React frontend, and Docker packaging.
- Official stable baseline: `BGmi/BGmi` tag `v5.0.2` at `03778d1` (2026-09-27). The official `master` has later unreleased commits and is outside this merge.
- Integration branch: `integration/bgmi-5.0.2`. Keep `main` deployable until integration tests pass.
- The repositories have no common Git ancestor for a direct merge: official backend files live at this repository's `BGmi/` path.

## Compatibility work

1. **Inventory and regression baseline.** Record the current backend, frontend, and Docker checks. Map custom endpoints and database fields to official v5 equivalents.
2. **Database migration safety.** Start from official v5 migration logic, adapt it to preserve personal columns (`source`, `in_library`, `library_path`, `created_time`) and `bangumi_issue`. Test migration of a representative custom v4 database, including subscribed episodes and filters. Keep a backup before any deployment migration.
3. **Official backend.** Bring official v5 core into `BGmi/`, including SQLAlchemy models, FastAPI server, MCP support, configuration, dependency lock, and upstream tests. Port custom library and maintenance operations to the v5 schema.
4. **Frontend and media API.** Adapt the custom frontend's existing requests and response types to v5 routes. Reintroduce its dashboard, local library, player, HLS, subtitles, and static file behavior through FastAPI routes.
5. **Docker and docs.** Update the image and entrypoint for Python 3.11+, v5 initialization and migration, frontend assets, health checks, and upgrade/rollback instructions.
6. **Validation.** Run backend tests (including migration and custom features), frontend type/build checks, and Docker build and smoke tests. Exercise subscription, calendar, download, dashboard, direct play, subtitles, and HLS on test data.
7. **Delivery.** Review the integration diff, document any limitations, commit the tested integration branch, then update the personal repository after the result is ready for review.

## Key risks found in the initial audit

- Official v5 replaced Peewee and Tornado with SQLAlchemy and FastAPI. Existing custom handlers and maintenance code cannot run unchanged.
- The official v4-to-v5 migration rebuilds `bangumi` and `download`, which would drop personal metadata columns unless adapted.
- Official v5's `bangumi.id` is a source ID string; the personal v4 database uses an integer ID. Code using IDs needs explicit translation.
- The personal frontend uses endpoints such as `/api/dashboard`, `/api/player`, and `/api/filter`; official v5 routes use different paths, request shapes, and authentication.
- The root `.gitignore` used to ignore `lib/` at every depth, leaving most `BGmi/bgmi/lib/` backend files out of Git. This rule is now scoped to a root `lib/` directory; the missing backend sources must be committed with the integration.

## Progress

- [x] Fetch and identify official stable tag.
- [x] Create integration branch and local read-only upstream worktree.
- [x] Audit architecture and identify migration risks.
- [x] Recover ignored local backend files from the July 10 Docker image and establish the baseline: 23 focused backend tests and frontend build pass.
- [ ] Implement database-safe v5 backend integration.
- [ ] Port personal APIs and frontend.
- [ ] Validate image and tests.
- [ ] Prepare integration commit and review summary.
