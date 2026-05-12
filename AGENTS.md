# DahTicket V2 Agent Guide

This file helps coding agents become productive quickly in this repository.

## Start Here

- Read [WORKFLOW_STATE.md](WORKFLOW_STATE.md) first for current scope, completed steps, and pending items.
- Follow local agent rules in [.agents/rules/agent-rules.md](.agents/rules/agent-rules.md).
- Domain-specific rule references:
  - Backend patterns: [.agents/rules/go-web-dev-expert.md](.agents/rules/go-web-dev-expert.md)
  - Frontend patterns: [.agents/rules/tailwind-css-expert.md](.agents/rules/tailwind-css-expert.md), [.agents/rules/modern-css-responsive-design-expert.md](.agents/rules/modern-css-responsive-design-expert.md), [.agents/rules/mobile-ui-ux-best.md](.agents/rules/mobile-ui-ux-best.md)

## Project Structure

- Backend (Go + Gin + GORM): `backend/`
  - HTTP handlers: `backend/handlers/`
  - auth middleware and role guards: `backend/middleware/`
  - DB connection + seeding: `backend/database/`
  - models/entities: `backend/models/`
- Frontend (React + Vite + TypeScript): `frontend/`
  - pages/routes: `frontend/src/pages/`
  - auth state: `frontend/src/contexts/AuthContext.tsx`
  - API clients: `frontend/src/services/api.ts`, `frontend/src/services/itamAPI.ts`
  - shared types: `frontend/src/types/`

## Run, Build, Lint

- Full stack (Docker):
  - `docker-compose up --build`
- Backend local:
  - `cd backend`
  - `go run main.go`
- Frontend local:
  - `cd frontend`
  - `npm install`
  - `npm run dev`
- Frontend checks:
  - `npm run lint`
  - `npm run build` (includes TypeScript project build)

Note: There are currently no documented backend tests/lint tasks in this repo.

## Configuration

- Frontend API URL: `VITE_API_URL` (default: `http://localhost:8080/api`).
- Vite dev proxy maps `/api` to `http://localhost:8080` in [frontend/vite.config.ts](frontend/vite.config.ts).
- Backend env vars are defined via `os.Getenv`, including:
  - JWT: `JWT_SECRET`, `JWT_EXPIRATION_HOURS`
  - Server: `PORT`
  - DB: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`
  - SLA: `SLA_LOW_HOURS`, `SLA_MEDIUM_HOURS`, `SLA_HIGH_HOURS`, `SLA_CRITICAL_HOURS`

## Auth and RBAC Conventions

- JWT token storage key on frontend: `dahticket_token`.
- Axios interceptor auto-attaches `Authorization: Bearer <token>` and redirects on 401 in [frontend/src/services/api.ts](frontend/src/services/api.ts).
- Backend route grouping pattern in [backend/main.go](backend/main.go):
  - public: `/api/auth/*`, `/api/health`
  - authenticated: `/api/*` via `AuthRequired()`
  - staff-only: IT Agent/Admin via `RoleRequired(models.RoleITAgent, models.RoleAdmin)`
  - admin-only: `/api/admin/*` via `RoleRequired(models.RoleAdmin)`

## Database and Seed Behavior

- Auto-migrations run at startup in [backend/main.go](backend/main.go).
- Default admin user is auto-seeded if no admin exists in [backend/database/seed.go](backend/database/seed.go):
  - email: `admin@dahticket.com`
  - password: `admin123`

## Working Rules for Agents

- Keep changes minimal and scoped to the request.
- Preserve existing API contracts and route paths unless migration/update is requested.
- For backend features, wire changes through model -> handler -> route registration when applicable.
- For frontend features, keep API typings aligned with backend payloads and response shapes.
- Update [WORKFLOW_STATE.md](WORKFLOW_STATE.md) after meaningful feature work so status remains accurate.

## Useful References

- Primary project status and decisions: [WORKFLOW_STATE.md](WORKFLOW_STATE.md)
- Docker orchestration and service ports: [docker-compose.yml](docker-compose.yml)
- Frontend template README (generic Vite): [frontend/README.md](frontend/README.md)