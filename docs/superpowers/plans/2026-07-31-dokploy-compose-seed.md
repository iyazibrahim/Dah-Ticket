# Dokploy Compose + Env Seed Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Make DigiDesk deployable on Dokploy with env-driven admin/demo/location seeding.

**Architecture:** Extend `docker-compose.prod.yml` `${VAR}` injection; update `seed.go` to read seed flags/credentials from env.

**Tech Stack:** Docker Compose, Go/GORM seed, Dokploy env panel

## Global Constraints

- Default admin email: `admin@digidesks.cc`
- Single domain via frontend nginx `/api` proxy
- Do not put secrets in compose literals

---

### Task 1: Seed env helpers + admin/demo/locations

**Files:** `backend/database/seed.go`

- [ ] Add `adminSeedEmail()`, `adminSeedPassword()`, `envBool(key, default)`
- [ ] Wire `SeedDefaultAdmin` to env email/password; keep legacy `admin@dahticket.com` migration path
- [ ] Gate `SeedDefaultUsers` with `SEED_DEMO_USERS` (default false)
- [ ] Gate location block in `SeedITAMDefaults` with `SEED_LOCATIONS` (default true)
- [ ] `go build ./...`

### Task 2: Compose + env docs

**Files:** `docker-compose.prod.yml`, `docker-compose.yml`, `.env.example`, `.env.production.example`, `DEPLOY.md`, `WORKFLOW_STATE.md`, README/SETUP credential lines

- [ ] Pass seed vars into backend environment
- [ ] Align local compose seed env (optional defaults)
- [ ] Document Dokploy checklist
- [ ] Validate and commit
