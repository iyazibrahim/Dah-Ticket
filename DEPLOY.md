# Production Deployment (Dokploy / Traefik)

## Quick start

```bash
cp .env.production.example .env
# Edit .env — set DB_PASSWORD, JWT_SECRET, ADMIN_PASSWORD, FRONTEND_URL

docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

## Dokploy + Traefik

1. Create a **Docker Compose** service (not Application / Nixpacks).
2. Compose file: **`docker-compose.prod.yml`**.
3. Environment panel: paste vars from `.env.production.example`.
4. Required: `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `ADMIN_PASSWORD`.
5. Set `FRONTEND_URL=https://your-domain.com` and `VITE_API_URL=/api`.
6. **Domains** tab → Add Domain:
   - Host: your domain
   - Service: **`frontend`**
   - Port: **`80`**
   - HTTPS / Let’s Encrypt as needed
7. Deploy, then wait ~10s for Traefik certificates.

Dokploy injects Traefik `Host` / TLS labels at deploy time. This compose already:
- Puts `frontend` on **`dokploy-network`** (Traefik can reach it)
- Sets **`traefik.docker.network=dokploy-network`** (required when frontend is also on `internal`)
- Keeps `db` + `backend` on a private **`internal`** network
- Pins backend to **`8080`** (nginx proxies `/api` → `backend:8080`)

### Traffic path

```
Internet → Traefik (Dokploy) → frontend:80 → nginx
                                      ├─ /        → React SPA
                                      └─ /api/*   → backend:8080
```

Do **not** put a Dokploy domain on `backend` or `db`.

### Dokploy env checklist

| Variable | Example | Notes |
|----------|---------|-------|
| `DB_USER` | `postgres` | Must match Postgres user |
| `DB_PASSWORD` | strong password | Must match on db + backend |
| `DB_NAME` | `dahticket` | |
| `JWT_SECRET` | `openssl rand -base64 32` | Required |
| `ADMIN_EMAIL` | `admin@digidesks.cc` | Seeded only if no super admin exists |
| `ADMIN_PASSWORD` | strong password | Required for first boot |
| `SEED_DEMO_USERS` | `false` | Demo agent/user accounts |
| `SEED_LOCATIONS` | `true` | PDL 1/2, BDL, BMDL, Digital Penang |
| `FRONTEND_URL` | `https://your-domain.com` | Emails + CORS |
| `VITE_API_URL` | `/api` | Baked at image build — redeploy after change |

### Common mistakes

- **Changing `PORT` / using 8085** — backend must stay on **8080** inside the stack. Public entry is Traefik → **frontend:80**.
- **Nixpacks Application** — wrong type; use Docker Compose.
- **Domain on wrong service/port** — must be `frontend` / `80`, then **redeploy**.
- **`VITE_API_URL=http://localhost:8080/api`** — browsers cannot reach server localhost.
- **DB password changed after first deploy** — Postgres only reads password on first volume init.
- **404 from Traefik** — confirm `frontend` is on `dokploy-network` (Preview Compose in Dokploy).

### After deploy

```bash
curl https://your-domain.com/api/health
```

Default admin (first boot only):

- Email: `ADMIN_EMAIL` (default `admin@digidesks.cc`)
- Password: `ADMIN_PASSWORD`

## Local vs production

| File | Use |
|------|-----|
| `docker-compose.yml` | Local (pgAdmin, published ports) |
| `docker-compose.prod.yml` | Dokploy / Traefik |

## API URL

Always **`/api`** in Docker/Dokploy (nginx proxy). Local `npm run dev` uses the Vite `/api` proxy.
