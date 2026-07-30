# Deploying Gembala

Two deployable images (`apps/api/Dockerfile`, `apps/web/Dockerfile`) plus a
Postgres database. Both Dockerfiles build from the **monorepo root** as
context (they need the workspace lockfile and `packages/shared`).

## Images

| Image | Base | Exposes | Notes |
|---|---|---|---|
| `gembala-api` | `node:20-alpine` | 3000 | NestJS, runs `node dist/main.js` |
| `gembala-api` (`--target migrate`) | `node:20-alpine` | — | runs `drizzle-kit migrate`, exits |
| `gembala-web` | `nginx:1.27-alpine` | 80 | static Vite build, SPA fallback |

`apps/web`'s API URL (`VITE_API_URL`) is baked into the JS bundle at **build
time**, not read at runtime — you need a separate web image build per
environment that points at a different API host (staging vs production).

## Required environment variables

**api / migrate**

| Var | Example |
|---|---|
| `DATABASE_URL` | `postgres://gembala:***@db-host:5432/gembala` |
| `JWT_SECRET` | long random string, unique per environment |
| `JWT_EXPIRES_IN` | `7d` |
| `PORT` | `3000` |
| `WEB_ORIGIN` | `https://app.staging.gembala.dev` (CORS allow-list, exact match) |

**web (build-time only)**

| Var | Example |
|---|---|
| `VITE_API_URL` | `https://api.staging.gembala.dev/api` |

Never bake `.env` files into the images — they're excluded via
`.dockerignore`. Inject secrets at deploy time (compose `environment:`,
your platform's secrets manager, etc).

## Option A — single host via docker compose

Good for staging or a small production VM.

```bash
export POSTGRES_PASSWORD=...          # or put these in a .env file
export DATABASE_URL=postgres://gembala:$POSTGRES_PASSWORD@db:5432/gembala
export JWT_SECRET=$(openssl rand -hex 32)
export WEB_ORIGIN=https://app.example.com
export VITE_API_URL=https://api.example.com/api

docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d db
docker compose -f docker-compose.prod.yml run --rm migrate
docker compose -f docker-compose.prod.yml up -d api web
```

`migrate` runs once and exits; `api` waits on it via
`depends_on: service_completed_successfully`, so re-running
`docker compose up -d` on a later deploy re-applies migrations before the
api container is (re)started. Put a reverse proxy (Caddy/Traefik/nginx) in
front of `web:8080` and `api:3000` for TLS and to route
`api.example.com` → api, everything else → web.

## Option B — separate registry + host (typical staging/production split)

1. **Build and push**, tagged per environment:

   ```bash
   docker build -f apps/api/Dockerfile -t registry.example.com/gembala-api:$(git rev-parse --short HEAD) .
   docker build -f apps/web/Dockerfile \
     --build-arg VITE_API_URL=https://api.staging.gembala.dev/api \
     -t registry.example.com/gembala-web:staging-$(git rev-parse --short HEAD) .

   docker push registry.example.com/gembala-api:$(git rev-parse --short HEAD)
   docker push registry.example.com/gembala-web:staging-$(git rev-parse --short HEAD)
   ```

   Repeat the `web` build with production's `VITE_API_URL` for a separate
   production tag.

2. **Migrate** before rolling the api out — run the `migrate` target as a
   one-off job against the target environment's `DATABASE_URL`:

   ```bash
   docker run --rm \
     -e DATABASE_URL=$DATABASE_URL \
     registry.example.com/gembala-api-migrate:$(git rev-parse --short HEAD)
   ```

   (build it with `--target migrate` and push it, or run migrations from CI
   directly against the DB using the `build` stage.)

3. **Roll out** `api` and `web` on your platform of choice (ECS, Cloud Run,
   Fly.io, Kubernetes, a plain VM with `docker run`/systemd). Point each at
   the env vars table above. Managed Postgres (RDS, Cloud SQL, Neon, etc.)
   is recommended over the `db` service in `docker-compose.prod.yml`, which
   is a minimal example, not a production database setup — no backups, no
   HA.

## First deploy checklist

- [ ] `JWT_SECRET` set, unique per environment, not reused from dev
- [ ] `WEB_ORIGIN` matches the exact web origin (CORS is exact-match, not wildcard)
- [ ] `VITE_API_URL` matches the environment the web image was built for
- [ ] `migrate` run against the target DB before `api` serves traffic
- [ ] Postgres reachable and backed up (managed service recommended)
- [ ] TLS terminated in front of both `api` and `web` (reverse proxy or platform LB)
- [ ] Mailer: `apps/api/src/mail` currently logs to console in dev — wire a
      real provider before production, or invites/password-resets go nowhere

## Rolling back

Images are tagged by commit SHA — redeploy the previous tag for `api`/`web`.
Migrations are forward-only (Drizzle); a rollback that depends on a schema
change requires either a compensating migration or restoring the DB from
backup.
