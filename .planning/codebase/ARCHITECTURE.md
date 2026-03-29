# ARCHITECTURE.md — System Architecture

## Pattern

**Monorepo** with two separate applications:
1. **Backend API** — Node.js/Express REST + WebSocket server
2. **Frontend** — Next.js 15 App Router SPA/SSR

## Backend Architecture

### Layer Structure

```
HTTP Request
    → Express Middleware (helmet, cors, rateLimit, requestLogger)
    → Sentry handlers
    → Route handler (src/routes/*.js)
    → Auth middleware (authenticateToken)
    → Validation middleware (validate, sanitize)
    → Controller (src/controllers/*.js) [where they exist]
    → Service layer (src/services/*.js)
    → Config/DB (src/config/database.js, redis.js)
```

### Entry Point

`src/index.js` — initializes:
1. Sentry (error monitoring)
2. Express app + middleware
3. 34 route modules registered under `/api/v1/`
4. Socket.io on the HTTP server
5. `initializeDatabase()` → DB pool + migrations
6. `initializeRedis()` → Redis client
7. `startBackgroundJobs()` → Bull queues + cron tasks

### Routes → Services Pattern

Each route file in `src/routes/` exports an Express Router. Route files either:
- Call controller methods (e.g., `src/controllers/sitesController.js`)
- Call service methods directly inline

Key route files:
- `src/routes/auth.js` — JWT login/register/refresh
- `src/routes/sites.js` — WordPress site management (most complex, has controller)
- `src/routes/content.js` — Content Publishing Hub
- `src/routes/backup.js` — Backup management
- `src/routes/monitoring.js` — Site monitoring
- `src/routes/agent.js` — AI agent interactions

### Background Jobs (`src/services/jobService.js`)

- Bull queues backed by Redis
- node-cron for scheduled tasks
- Jobs: health checks, backup scheduling, AI analysis, notifications

### WebSocket Events

Socket.io mounted on same HTTP server. Used for:
- Real-time monitoring updates
- AI agent live panel (streaming)
- Site health status changes

## Frontend Architecture

### App Router Structure (`wpma-frontend/app/`)

```
/ (landing redirect)
/auth/login, /auth/register
/dashboard/ (layout.tsx wraps all dashboard pages)
  /dashboard/page.tsx — main dashboard
  /dashboard/agent/ — AI agent
  /dashboard/backups/
  /dashboard/monitoring/
  /dashboard/notifications/
  /dashboard/performance/
  /dashboard/reports/
  /dashboard/security/
  /dashboard/staging/
  /dashboard/team/
  /dashboard/updates/
  /dashboard/content/ (Content Hub)
/sites/ — site management
/billing/
/client-portal/
/profile/
```

### Data Flow (Frontend)

```
Next.js Page/Component
    → TanStack Query (server state) OR Zustand (global state)
    → wpma-frontend/lib/api.ts (axios client with JWT)
    → Backend API
```

### State Management

- **Zustand** (`lib/auth-store.ts`) — auth state, user session
- **TanStack Query** — API data fetching/caching
- **Socket.io client** — real-time updates

## WordPress Agent

`wpma-agent/` — standalone PHP files deployed to managed WP sites:
- `wpma-agent/wpma-publisher.php` — entry point
- `wpma-agent/includes/class-wpma-publisher.php` — HMAC-verified webhook handler

## API Response Contract

All backend responses follow:
```json
{ "success": true|false, "data": {...}, "error": "string", "message": "string" }
```

## Infrastructure (Docker)

```
nginx-proxy (external)
    → wpma-backend :8010→8000
    → wpma-frontend :3010→3000
    → wpma-landing :8081→80
wpma-postgres :5434→5432
wpma-redis :6381→6379
```
