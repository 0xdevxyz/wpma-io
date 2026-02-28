# AGENTS.md

## Cursor Cloud specific instructions

### Project Overview

WPMA.io is a WordPress Management AI Platform with:
- **Backend API** (`/workspace`) — Node.js/Express on port 8000
- **Frontend** (`/workspace/wpma-frontend`) — Next.js 15 on port 3000
- **WordPress Plugin** (`/workspace/wpma-agent`) — PHP plugin (not needed for local dev)

### Required Infrastructure

PostgreSQL 16 and Redis 7 must be running before starting the backend. Start them with:

```bash
sudo pg_ctlcluster 16 main start
sudo redis-server --daemonize yes --port 6379
```

### Environment Files

- Backend: `/workspace/.env` — must contain `DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY` (can be a dummy `sk_test_...` value), `REDIS_HOST`, `REDIS_PORT`.
- Frontend: `/workspace/wpma-frontend/.env.local` — must set `NEXT_PUBLIC_API_URL=http://localhost:8000`.

### Running the Application

- **Backend**: `npm run dev` (uses nodemon, port 8000)
- **Frontend**: `npm run dev` in `wpma-frontend/` (uses Turbopack, port 3000)
- **Migrations**: `DATABASE_URL="postgresql://wpma_user:wpma_dev_password@localhost:5432/wpma_db" npm run migrate` (the migrate script does not load dotenv automatically)

### Running Tests & Lint

- **Backend tests**: `npm test` (Jest, 62/64 tests pass — 2 pre-existing failures in performanceService)
- **Backend lint**: `npm run lint` — requires an `.eslintrc` config file which is currently missing from the repo
- **Frontend lint**: `npm run lint` in `wpma-frontend/` — runs but has pre-existing `@typescript-eslint/no-explicit-any` warnings
- **Frontend build**: `npm run build` in `wpma-frontend/`

### Gotchas

- The `scripts/migrate.js` does not load `.env` via dotenv. You must pass `DATABASE_URL` as an environment variable explicitly when running migrations.
- `STRIPE_SECRET_KEY` must be non-empty or the backend will crash at startup. Use `sk_test_dummy_key_for_local_dev_only` for local development.
- The `pdfkit` package is required at runtime but missing from `package.json` — it's installed via `npm install` but needs to be present in `node_modules`.
- The sites creation API has a field naming mismatch: Joi validation expects camelCase (`siteUrl`, `siteName`) but the controller destructures snake_case (`site_url`, `site_name`). This is a pre-existing bug.
- The backend uses `express@5` which is still in beta and has slightly different API behavior from v4.
- Redis password is optional in the Redis config — no password is needed for local dev.
- The `Migration 002` warning about `site_updates` table not existing is benign and does not block startup.
