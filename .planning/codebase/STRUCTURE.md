# STRUCTURE.md — Directory Layout

## Root

```
/home/clawd/saas/wpma-io/
├── src/                    # Backend source
├── wpma-frontend/          # Next.js frontend
├── wpma-agent/             # WordPress plugin/agent
├── landing/                # Static landing page (nginx served)
├── scripts/                # DB migration scripts
├── src/migrations/         # SQL migration files
├── docker-compose.yml      # Development/staging compose
├── docker-compose.prod.yml # Production compose
├── Dockerfile              # Backend container
├── jest.config.js          # Test config
├── ecosystem.config.js     # PM2 config
├── env.example             # Env template
└── init-db.sql             # DB init script
```

## Backend (`src/`)

```
src/
├── index.js                # Entry point — app init, route registration
├── routes/                 # 34 route files (one per feature domain)
│   ├── auth.js
│   ├── sites.js
│   ├── content.js
│   ├── backup.js
│   ├── monitoring.js
│   ├── agent.js
│   └── ... (31 more)
├── controllers/            # Business logic (sites has explicit controller)
│   └── sitesController.js
├── services/               # 35 service files (core business logic)
│   ├── aiService.js        # AI/LLM orchestration
│   ├── contentService.js   # Content generation + CRUD
│   ├── backupService.js    # Backup logic
│   ├── healthCheckService.js
│   ├── jobService.js       # Background jobs
│   ├── llmService.js       # LLM provider abstraction
│   ├── pexelsService.js    # Pexels media
│   ├── publisherService.js # Content publishing adapters
│   └── ... (27 more)
├── middleware/
│   ├── auth.js             # JWT auth + WP API key auth
│   ├── errorHandler.js     # Express error handlers
│   ├── validate.js         # Joi validation + sanitize
│   └── performance.js      # Request timing
├── config/
│   ├── database.js         # pg Pool
│   ├── redis.js            # Redis client
│   ├── sentry.js           # Sentry init
│   └── env.js              # Env validation
├── validators/
│   └── schemas.js          # Joi schemas (shared)
├── utils/
│   └── logger.js           # Winston logger
└── migrations/             # SQL files
    ├── 001_initial_schema.sql
    ├── 002_missing_tables.sql
    ├── 003_content_hub.sql
    ├── 004_agent_revenue.sql
    └── ... (more)
```

## Frontend (`wpma-frontend/`)

```
wpma-frontend/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Root page
│   ├── globals.css
│   ├── auth/
│   │   └── login/page.tsx
│   ├── dashboard/
│   │   ├── layout.tsx      # Dashboard shell layout
│   │   ├── page.tsx        # Main dashboard
│   │   ├── agent/page.tsx  # AI agent
│   │   ├── backups/
│   │   ├── monitoring/
│   │   ├── notifications/
│   │   ├── performance/
│   │   ├── reports/
│   │   ├── security/
│   │   ├── staging/
│   │   ├── team/
│   │   └── updates/
│   ├── sites/              # Site management
│   ├── billing/
│   ├── client-portal/
│   └── profile/
├── components/
│   ├── app-header.tsx
│   ├── auth-provider.tsx
│   ├── navbar.tsx
│   ├── theme-provider.tsx
│   ├── dashboard/          # Dashboard-specific components
│   │   ├── agent-live-panel.tsx
│   │   ├── command-palette.tsx
│   │   └── ...
│   ├── content/            # Content Hub components
│   ├── site-details/       # Site detail components
│   └── ui/                 # Generic UI primitives
├── lib/
│   ├── api.ts              # Axios API client (all endpoints)
│   ├── auth-store.ts       # Zustand auth store
│   ├── dashboard-config.ts # Dashboard layout config
│   └── theme-store.ts      # Theme state
├── Dockerfile
└── package.json
```

## WordPress Agent (`wpma-agent/`)

```
wpma-agent/
├── wpma-publisher.php                      # Entry point
└── includes/
    └── class-wpma-publisher.php            # HMAC-verified content receiver
```

## Key File Quick Reference

| What | Where |
|------|-------|
| Backend entry | `src/index.js` |
| Auth middleware | `src/middleware/auth.js` |
| DB query | `src/config/database.js` → `const { query }` |
| API client (frontend) | `wpma-frontend/lib/api.ts` |
| Auth state (frontend) | `wpma-frontend/lib/auth-store.ts` |
| Dashboard layout | `wpma-frontend/app/dashboard/layout.tsx` |
| Env template | `env.example` |
| Docker setup | `docker-compose.yml` |
