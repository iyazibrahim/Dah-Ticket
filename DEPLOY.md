# Production Deployment (Dokploy / EC2)

## Quick start

```bash
cp .env.production.example .env
# Edit .env — set DB_PASSWORD, JWT_SECRET, ADMIN_PASSWORD, SMTP (optional)

docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

## Dokploy

1. Point Dokploy at **`docker-compose.prod.yml`** (not the local `docker-compose.yml`).
2. In the Dokploy **Environment** panel, set the same variables as `.env.production.example`.
3. Required keys: `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `ADMIN_PASSWORD`.
4. Set **`VITE_API_URL=/api`** (relative URL — nginx proxies to backend).
5. Assign your domain to the **frontend** service (port **80** inside the container).
6. Ensure **`dokploy-network`** exists (Dokploy creates this automatically).

Compose uses `${VAR}` so Dokploy’s `.env` values are injected into containers. Do not rely on env alone without listing keys under `environment:`.

### Dokploy env checklist

| Variable | Example | Notes |
|----------|---------|-------|
| `DB_USER` | `postgres` | Must match Postgres user |
| `DB_PASSWORD` | strong password | Must match on db + backend |
| `DB_NAME` | `dahticket` | |
| `JWT_SECRET` | `openssl rand -base64 32` | Required |
| `ADMIN_EMAIL` | `admin@digidesks.cc` | Seeded only if no super admin exists |
| `ADMIN_PASSWORD` | strong password | Required for first boot |
| `SEED_DEMO_USERS` | `false` | Set `true` only if you want agent/user demos |
| `SEED_LOCATIONS` | `true` | Seeds PDL 1/2, BDL, BMDL, Digital Penang |
| `FRONTEND_URL` | `https://your-domain.com` | Email deep links |
| `VITE_API_URL` | `/api` | Baked at **image build** — redeploy after change |

### Common mistakes

- **Hardcoded env in compose** — prod compose uses `${VAR}`; set values in Dokploy Environment.
- **`VITE_API_URL=http://localhost:8080/api`** — wrong for production; browsers cannot reach server localhost.
- **DB password changed after first deploy** — Postgres only reads `POSTGRES_PASSWORD` on first volume init.
- **Exposing db/backend ports** — prod compose keeps them internal; only frontend joins `dokploy-network`.

### After deploy

```bash
curl https://your-domain.com/api/health
```

Default admin (first boot only; change immediately if you used the example password):

- Email: value of `ADMIN_EMAIL` (default `admin@digidesks.cc`)
- Password: value of `ADMIN_PASSWORD`

## Local dev vs production

| File | Use |
|------|-----|
| `docker-compose.yml` | Local development (pgAdmin, exposed ports, demo users on) |
| `docker-compose.prod.yml` | Production / Dokploy |

## API URL standard

All environments use **`/api`**:

- **Local `npm run dev`** — Vite proxies `/api` → `localhost:8080`
- **Docker / Dokploy** — nginx proxies `/api` → backend container

No per-environment URL changes needed unless frontend and API are on different domains.
