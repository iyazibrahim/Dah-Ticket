# Dokploy Compose + Env Seed Design

**Date:** 2026-07-31  
**Status:** Approved

## Goals

- Single-domain Dokploy deploy via `docker-compose.prod.yml` (frontend:80, nginx proxies `/api`).
- Admin seed credentials from env (`ADMIN_EMAIL`, `ADMIN_PASSWORD`).
- Demo users gated by `SEED_DEMO_USERS` (default false).
- Built-in locations gated by `SEED_LOCATIONS` (default true).

## Defaults

| Variable | Default |
|----------|---------|
| `ADMIN_EMAIL` | `admin@digidesks.cc` |
| `ADMIN_PASSWORD` | `admin123` |
| `SEED_DEMO_USERS` | `false` |
| `SEED_LOCATIONS` | `true` |

## Out of scope

- Custom location JSON via env
- pgAdmin in production compose
