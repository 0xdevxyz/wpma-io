# WPMA.io — System Architecture & Developer Reference

> Stand: April 2026 | Quelle: Direkt aus dem Code gelesen, nicht aus alten Docs.

---

## 1. Übersicht

WPMA ist eine SaaS-Plattform zur KI-gestützten Verwaltung mehrerer WordPress-Sites.

**Live-URLs:**
- Landing: `https://wpma.io`
- Dashboard: `https://app.wpma.io`
- API: `https://api.wpma.io`

**Drei Hauptkomponenten:**
1. `src/` — Backend API (Node.js/Express 5, CommonJS)
2. `wpma-frontend/` — Frontend Dashboard (Next.js 15, TypeScript)
3. `wpma-agent/` — WordPress-Plugin (PHP 7.4+, Version 1.3.0)

---

## 2. Verzeichnisstruktur (Top-Level)

```
wpma-io/
├── src/                        # Backend API
│   ├── index.js                # Einstiegspunkt: Express, Socket.IO, Cron, Migrationen
│   ├── routes/                 # 34 Route-Dateien
│   ├── controllers/            # Business Logic
│   ├── services/               # Services (jobService, agentService, etc.)
│   ├── middleware/             # auth.js, validate.js, etc.
│   ├── config/                 # database.js (Pool + Migrationen)
│   ├── migrations/             # SQL-Migrations-Dateien (001_, 002_, ...)
│   └── validators/             # Joi-Schemas
├── wpma-frontend/              # Next.js Frontend
│   ├── app/                    # App Router Pages
│   ├── components/             # React-Komponenten
│   ├── lib/                    # api.ts, auth-store.ts, theme-store.ts
│   └── types/                  # TypeScript-Typdefinitionen
├── wpma-agent/                 # WordPress Plugin
│   ├── wpma-agent.php          # Haupt-Plugin-Datei
│   ├── includes/               # PHP-Klassen
│   └── admin/                  # WP-Admin-UI
├── landing/                    # Statische Landingpage (nginx)
├── scripts/                    # Deployment & Migration Scripts
├── docs/                       # Alte Dokumentation
├── releases/                   # Plugin ZIP-Releases
├── etc/nginx/                  # Nginx-Konfiguration
├── package.json                # Backend-Paket (Node.js)
├── Dockerfile                  # Backend Docker Image
├── docker-compose.yml          # Dev/Prod Orchestration
├── docker-compose.prod.yml     # Production Overrides
├── ecosystem.config.js         # PM2 Konfiguration (Produktion)
├── env.example                 # Umgebungsvariablen-Template
├── healthcheck.js              # Docker Health Check
└── deploy.sh                   # Deployment-Helfer
```

---

## 3. Tech Stack

### Backend (`src/`)

| Schicht | Technologie | Version |
|---|---|---|
| Runtime | Node.js | >=18 |
| Framework | Express | 5.x |
| Datenbank | PostgreSQL | 16 (via `pg` Pool) |
| Cache/Queue | Redis | 7 (via `redis` Client) |
| Real-time | Socket.IO | 4.x |
| Background Jobs | node-cron, Bull | - |
| Auth | jsonwebtoken, bcryptjs | - |
| KI | Anthropic Claude SDK, OpenAI, LangChain | aktuellste |
| Zahlungen | Stripe | 18.x |
| E-Mail | Nodemailer | 8.x |
| Storage | aws-sdk (S3 + iDrive E2) | 2.x |
| PDF | PDFKit | 0.17 |
| Monitoring | @sentry/node | 9.x |
| Logging | Winston | 3.x |
| Validierung | Joi | 17.x |
| HTTP-Scraping | Cheerio | 1.x |
| ZIP | adm-zip, archiver | - |
| Sprache | JavaScript (CommonJS) | - |

### Frontend (`wpma-frontend/`)

| Schicht | Technologie | Version |
|---|---|---|
| Framework | Next.js (Turbopack) | 15.x |
| UI | React, TailwindCSS | 19.x / 3.x |
| State | Zustand (`persist`) | 5.x |
| Data Fetching | TanStack React Query | 5.x |
| Charts | Recharts, Chart.js + react-chartjs-2 | 3.x / 4.x |
| Forms | react-hook-form | 7.x |
| Animationen | Framer Motion | 12.x |
| Icons | Lucide React | 0.525 |
| Real-time | socket.io-client | 4.x |
| Notifications | react-hot-toast | 2.x |
| HTTP-Client | Axios | 1.x |
| Datum | date-fns | 4.x |
| Testing | Playwright (E2E) | 1.x |
| Sprache | TypeScript | 5.x |

### WordPress Plugin (`wpma-agent/`)

| | |
|---|---|
| Sprache | PHP 7.4+ |
| Platform | WordPress 5.8+ |
| Version | 1.3.0 |
| API-Base | `https://api.wpma.io` |
| Kommunikation | WP REST API (`/wp-json/wpma/v1/*`) |

---

## 4. Backend — `src/index.js`

Der Express-Server beim Start:
1. Lädt `.env` (dotenv)
2. Initialisiert Sentry + Winston-Logger
3. Registriert alle Route-Module unter `/api/v1/`
4. Erstellt HTTP-Server + Socket.IO (JWT-Middleware, User joined `user_<userId>` Room)
5. Rate Limiting: 1000 req/15min global; 20 req/15min auf `/api/v1/auth`
6. Dynamisches CORS: `app.wpma.io`, localhost, White-Label-Domains (Redis-gecacht)
7. PostgreSQL verbinden → Migrationen ausführen → Redis verbinden → Cron Jobs starten
8. Graceful Shutdown auf SIGTERM/SIGINT

### Background Jobs (`src/services/jobService.js`) — aus Code gelesen

| Schedule | Job | Details |
|---|---|---|
| Alle 5 Min | Uptime-Checks | bis zu 50 aktive Sites via `monitoringService.checkUptime` |
| Alle 30 Min | Performance-Cleanup | `performanceService.cleanupOldMetrics` |
| Alle 30 Min | Health-Pull | HTTP GET `<site_url>/wp-json/wpma/v1/health` für alle Sites mit `last_plugin_connection`; updated health_score, wordpress_version, php_version, update_count |
| Alle 1 Min | Auto-Backups | `backupService.runDueScheduledBackups()` |
| Alle 15 Min | KI-Agent-Scans | `agentService.scanAllSites()` |
| Täglich 02:00 | Security-Scans | bis zu 50 aktive Sites via `securityService.performScan` |
| Täglich 03:00 | SSL-Checks | `sslService.checkAllSites()` |
| Täglich 04:00 | Daten-Cleanup | Performance + Security Cleanup |
| 1. des Monats 01:00 | Monatsberichte | `sendMonthlyReports()` |
| 1 Min nach Start | SSL-Check (einmalig) | verzögert, one-off |

---

## 5. API-Routen — vollständige Liste aus `src/index.js`

Alle unter `/api/v1/`. Auth = `Authorization: Bearer <JWT>` via `authenticateToken` Middleware.

> Hinweis: `emailEncryption.js` existiert in `src/routes/`, ist aber **nicht gemountet** in `index.js`.
> Hinweis: `/reports` ist zweimal gemountet (`reports.js` + `maintenanceReports.js`) — potentieller Konflikt.

### Auth (`routes/auth.js`)

```
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
GET  /api/v1/auth/me
PUT  /api/v1/auth/profile
POST /api/v1/auth/change-password
POST /api/v1/auth/logout
```

### Sites (`routes/sites.js`)

```
POST /api/v1/sites/setup-token/exchange     # public
POST /api/v1/sites/auto-connect             # public
GET  /api/v1/sites/plugin/download/:token   # public, CORS *
PUT  /api/v1/sites/:siteId/health           # API-Key Auth (WP Plugin)

POST /api/v1/sites/fetch-metadata           # auth
GET  /api/v1/sites/                         # auth
POST /api/v1/sites/                         # auth
GET  /api/v1/sites/:siteId                  # auth
POST /api/v1/sites/:siteId/health-check     # auth
DELETE /api/v1/sites/:siteId                # auth
POST /api/v1/sites/:siteId/setup-token/regenerate  # auth
POST /api/v1/sites/:siteId/verify-plugin    # auth
```

### Plugins (`routes/plugins.js`)

```
GET    /api/v1/plugins/:siteId                          # auth
POST   /api/v1/plugins/:siteId/install                  # auth, body: { slug, activate? }
PUT    /api/v1/plugins/:siteId/:pluginSlug               # auth
POST   /api/v1/plugins/:siteId/:pluginSlug/toggle        # auth, body: { active: boolean }
DELETE /api/v1/plugins/:siteId/:pluginSlug               # auth
```

### Themes (`routes/themes.js`)

```
GET    /api/v1/themes/:siteId                           # auth
POST   /api/v1/themes/:siteId/install                   # auth
POST   /api/v1/themes/:siteId/:themeSlug/activate       # auth
PUT    /api/v1/themes/:siteId/:themeSlug                 # auth
DELETE /api/v1/themes/:siteId/:themeSlug                 # auth
```

### Agent (`routes/agent.js`)

```
GET  /api/v1/agent/tasks                    # auth
GET  /api/v1/agent/stats                    # auth
GET  /api/v1/agent/tasks/:id                # auth
POST /api/v1/agent/tasks/:id/approve        # auth
POST /api/v1/agent/tasks/:id/reject         # auth
POST /api/v1/agent/scan/:siteId             # auth
GET  /api/v1/agent/settings                 # auth
PUT  /api/v1/agent/settings                 # auth
PUT  /api/v1/agent/settings/manual-mode     # auth
POST /api/v1/agent/scan-all                 # auth
```

### Self-Healing (`routes/selfhealing.js`)

```
POST /api/v1/selfhealing/analyze            # JWT auth
POST /api/v1/selfhealing/apply              # JWT auth
POST /api/v1/selfhealing/auto               # API-Key auth (WP Plugin ruft das auf)
GET  /api/v1/selfhealing/history/:siteId    # JWT auth
```

### Staging (`routes/staging.js`)

```
POST /api/v1/staging/:siteId/create         # auth
GET  /api/v1/staging/                       # auth
DELETE /api/v1/staging/:stagingId           # auth
POST /api/v1/staging/:stagingId/push        # auth
POST /api/v1/staging/:stagingId/pull        # auth
GET  /api/v1/staging/sync-job/:jobId        # auth
POST /api/v1/staging/:siteId/clone          # auth
GET  /api/v1/staging/clone-job/:jobId       # auth
POST /api/v1/staging/:siteId/migrate        # auth
GET  /api/v1/staging/migration-job/:jobId   # auth
```

### Bulk (`routes/bulk.js`)

```
POST   /api/v1/bulk/updates                 # auth, body: { siteIds[], updatePlugins, updateThemes, updateCore, createBackup, forceUpdate }
GET    /api/v1/bulk/updates/summary         # auth
POST   /api/v1/bulk/backups                 # auth, body: { siteIds[], backupType, provider }
POST   /api/v1/bulk/plugins/install         # auth, body: { siteIds[], pluginSlug }
POST   /api/v1/bulk/plugins/deactivate      # auth, body: { siteIds[], pluginSlug }
POST   /api/v1/bulk/security/scan           # auth
GET    /api/v1/bulk/jobs                    # auth
GET    /api/v1/bulk/jobs/:jobId             # auth
DELETE /api/v1/bulk/jobs/:jobId             # auth
```

### Content (`routes/content.js`)

```
GET    /api/v1/content/projects
POST   /api/v1/content/projects
GET    /api/v1/content/projects/:id
PUT    /api/v1/content/projects/:id
POST   /api/v1/content/projects/:id/rotate-token
DELETE /api/v1/content/projects/:id
POST   /api/v1/content/generate
GET    /api/v1/content/posts
POST   /api/v1/content/posts
GET    /api/v1/content/posts/:id
PUT    /api/v1/content/posts/:id
DELETE /api/v1/content/posts/:id
GET    /api/v1/content/media/search
GET    /api/v1/content/media/curated
POST   /api/v1/content/posts/:id/media
DELETE /api/v1/content/media/:mediaId
POST   /api/v1/content/publish/:postId
GET    /api/v1/content/track
GET    /api/v1/content/stats
```

### Client Portal (`routes/clientPortal.js`)

```
POST /api/v1/client-portal/login            # public
GET  /api/v1/client-portal/me               # client-token auth
GET  /api/v1/client-portal/sites            # client-token auth

GET  /api/v1/clients/                       # JWT auth
POST /api/v1/clients/                       # JWT auth
PUT  /api/v1/clients/:clientId              # JWT auth
DELETE /api/v1/clients/:clientId            # JWT auth
GET  /api/v1/clients/:clientId/sites        # JWT auth
POST /api/v1/clients/:clientId/sites        # JWT auth
```

### Revenue (`routes/revenue.js`)

```
POST /api/v1/revenue/:siteId/snapshot       # kein Auth (WP Plugin pusht)
POST /api/v1/revenue/:siteId/event          # kein Auth (WP Plugin pusht)
GET  /api/v1/revenue/:siteId/summary        # JWT auth
GET  /api/v1/revenue/:siteId/correlations   # JWT auth
GET  /api/v1/revenue/:siteId/impact         # JWT auth
POST /api/v1/revenue/:siteId/correlations/:corrId/resolve  # JWT auth
POST /api/v1/revenue/:siteId/analyze        # JWT auth
```

### WP Users (`routes/wpUsers.js`)

```
GET /api/v1/wp-users/:siteId               # JWT auth
```

### Weitere Routen (alle JWT auth)

| Route-Prefix | Modul |
|---|---|
| `/api/v1/security` | `security.js` |
| `/api/v1/backup` | `backup.js` |
| `/api/v1/performance` | `performance.js` |
| `/api/v1/ai` | `ai.js` |
| `/api/v1/monitoring` | `monitoring.js` |
| `/api/v1/updates` | `updates.js` |
| `/api/v1/chat` | `chat.js` |
| `/api/v1/incremental-backup` | `incrementalBackup.js` |
| `/api/v1/payment` | `payment.js` |
| `/api/v1/sync` | `sync.js` |
| `/api/v1/onboarding` | `onboarding.js` |
| `/api/v1/links` | `links.js` |
| `/api/v1/ssl` | `ssl.js` |
| `/api/v1/vulnerabilities` | `vulnerabilities.js` |
| `/api/v1/rollback` | `rollback.js` |
| `/api/v1/reports` | `reports.js` + `maintenanceReports.js` |
| `/api/v1/team` | `team.js` |
| `/api/v1/white-label` | `whiteLabel.js` |
| `/api/v1/notifications` | `notifications.js` |
| `/api/v1/email-recovery` | `emailRecovery.js` |

---

## 6. Authentifizierung

| Typ | Mechanismus |
|---|---|
| Dashboard-User | JWT in `localStorage`; `Authorization: Bearer <token>`; Revokation via Redis-Blacklist `blacklist:<token>` |
| WordPress-Plugin → Backend | `X-WPMA-Key` Header oder `Authorization: Bearer <api_key>` |
| Client-Portal | Eigener JWT (`type: 'client'`), signiert mit gleichem `JWT_SECRET` |
| Setup-Flow | Einmalig-`setup_token` (64 Zeichen) in Plugin-ZIP injiziert; per `POST /sites/setup-token/exchange` gegen permanenten `api_key` getauscht |

---

## 7. WordPress Plugin REST Endpoints

### `wpma-agent.php` (primär, Auth: `X-WPMA-Key`)

```
GET  /wp-json/wpma/v1/status     # public
POST /wp-json/wpma/v1/key-sync   # public (setup-token flow)
GET  /wp-json/wpma/v1/health     # X-WPMA-Key
GET  /wp-json/wpma/v1/plugins    # X-WPMA-Key
```

### `class-wpma-rest-api.php` (sekundär, Auth: `X-WPMA-API-Key`)

> Achtung: Anderer Header-Name (`X-WPMA-API-Key` statt `X-WPMA-Key`) — potentieller Konflikt bei doppelten Route-Registrierungen (z.B. `/wp-json/wpma/v1/plugins`).

```
GET /wp-json/wpma/v1/plugins
GET /wp-json/wpma/v1/themes
GET /wp-json/wpma/v1/core-update
GET /wp-json/wpma/v1/stats
GET /wp-json/wpma/v1/security-check
GET /wp-json/wpma/v1/performance
GET /wp-json/wpma/v1/screenshot
```

### WP-Cron-Jobs (im Plugin)

| Hook | Frequenz |
|---|---|
| `wpma_health_check` | Stündlich |
| `wpma_security_scan` | Täglich |
| `wpma_backup_check` | Täglich |
| `wpma_performance_check` | Stündlich |

---

## 8. Frontend — Vollständige Seiten- und Komponentenliste

### Pages (`wpma-frontend/app/`) — aus Dateisystem

```
app/
├── layout.tsx
├── page.tsx                        # Root-Redirect
├── not-found.tsx
├── globals.css
├── auth/
│   ├── login/page.tsx
│   ├── register/page.tsx
│   └── forgot-password/page.tsx
├── billing/page.tsx
├── bulk-operations/page.tsx
├── profile/page.tsx
├── client-portal/
│   ├── page.tsx
│   └── dashboard/page.tsx
├── dashboard/
│   ├── layout.tsx
│   ├── page.tsx                    # Haupt-Dashboard (Agent-zentriert, Approve-Queue, Live-Feed)
│   ├── agent/page.tsx              # Agent Settings: Scan-Frequenz, Auto-Approve-Level, Manual-Mode
│   ├── backups/page.tsx
│   ├── clients/page.tsx
│   ├── content/
│   │   ├── page.tsx
│   │   ├── create/page.tsx
│   │   └── track/page.tsx
│   ├── monitoring/page.tsx
│   ├── notifications/page.tsx
│   ├── performance/page.tsx
│   ├── reports/page.tsx
│   ├── security/page.tsx
│   ├── staging/page.tsx
│   ├── team/page.tsx
│   ├── updates/page.tsx
│   └── white-label/page.tsx
└── sites/[id]/
    ├── page.tsx                    # Site-Detail: Health, Versions, Performance, Security, Backups, AI Insights
    ├── links/page.tsx
    ├── performance/page.tsx
    ├── plugins/page.tsx
    ├── reports/page.tsx
    ├── revenue/page.tsx
    ├── risk-analysis/page.tsx
    ├── security/page.tsx
    ├── staging/page.tsx
    └── updates/page.tsx
```

### Komponenten (`wpma-frontend/components/`) — aus Dateisystem

```
components/
├── dashboard/
│   ├── agent-live-panel.tsx        # Live-Queue: pending approvals, active tasks, completed (10s/8s polling)
│   ├── ai-assistant-overlay.tsx
│   ├── ai-insights-panel.tsx
│   ├── ai-insights-widget.tsx
│   ├── auto-updates-panel.tsx
│   ├── bulk-action-bar.tsx
│   ├── bulk-actions-panel.tsx
│   ├── column-config-dropdown.tsx
│   ├── command-palette.tsx
│   ├── create-site-modal.tsx
│   ├── onboarding-stepper.tsx
│   ├── performance-chart.tsx
│   ├── plugin-setup-modal.tsx
│   ├── real-time-activity-feed.tsx
│   ├── security-news-box.tsx
│   ├── site-card.tsx
│   ├── site-inline-panel.tsx
│   └── site-table.tsx
│   └── stats-card.tsx
├── site-details/
│   └── plugins-tab.tsx
├── ui/
│   ├── button.tsx
│   ├── card.tsx
│   └── input.tsx
├── app-header.tsx
├── auth-provider.tsx
├── EmailRecovery.tsx
├── navbar.tsx
└── theme-provider.tsx
```

### State & API (`wpma-frontend/lib/`)

| Datei | Inhalt |
|---|---|
| `api.ts` | `ApiClient` (Axios, JWT-Interceptor, 401→Redirect). Exports: `authApi`, `sitesApi`, `agentApi`, `securityApi`, `bulkApi`, `backupApi`, `performanceApi`, `aiApi` + weitere |
| `auth-store.ts` | Zustand `persist`: `login`, `logout`, `loadUser`, `refreshToken` |
| `theme-store.ts` | Dark/Light-Modus |
| `dashboard-config.ts` | Dashboard-Konfiguration |

---

## 9. Bekannte Bugs im Code (aus Code-Analyse)

| Datei | Problem |
|---|---|
| `src/index.js` | `/reports` ist zweimal gemountet (`reports.js` + `maintenanceReports.js`) — der zweite Mount überschreibt den ersten |
| `src/routes/emailEncryption.js` | Datei existiert, aber nicht in `index.js` gemountet |
| `components/dashboard/agent-live-panel.tsx` | Active-Tasks-Block ist doppelt gerendert (Zeilen ~211-260) — visueller Bug |
| `wpma-agent/includes/class-wpma-rest-api.php` | Nutzt `X-WPMA-API-Key`, Haupt-Plugin nutzt `X-WPMA-Key` — inkonsistent; `/wp-json/wpma/v1/plugins` ist in beiden Dateien registriert |

---

## 10. Datenbankschema

Migrationen laufen sequenziell beim Start via `src/config/database.js`. SQL-Dateien in `src/migrations/`.

### Kern

| Tabelle | Beschreibung |
|---|---|
| `users` | Accounts: E-Mail, Passwort-Hash, Plan, Stripe-IDs |
| `sites` | Verwaltete WP-Sites: Domain, api_key, setup_token, Health/Security/Performance-Scores, WP/PHP-Versionen |
| `site_settings` | Per-Site-Konfiguration |
| `activity_logs` | Audit-Log |
| `alerts` | Site-Alerts |

### KI & Agent

| Tabelle | Beschreibung |
|---|---|
| `agent_tasks` | Autonomer KI-Agent Task-Queue |
| `agent_actions` | Einzelne Aktionsschritte |
| `agent_settings` | Per-User: Auto-Approve-Level, Manual-Mode, Scan-Frequenz |
| `ai_conversations` / `chat_conversations` | Chat-Sessions |
| `ai_messages` / `chat_messages` | Nachrichten |
| `ai_insights` | KI-generierte Insights |
| `predictive_insights` | Predictive Analytics |
| `selfhealing_fixes` / `self_healing_logs` | Fix-Einträge |

### Security & Monitoring

| Tabelle | Beschreibung |
|---|---|
| `security_scans` | Scan-Ergebnisse |
| `vulnerability_alerts` | Vulnerability-Alerts mit KI-Relevanz-Score |
| `ssl_certs` | SSL-Zertifikat-Status |
| `uptime_checks` | Uptime-Poll-Ergebnisse |
| `uptime_incidents` | Downtime-Incidents |
| `uptime_monitors` | Monitor-Konfiguration |
| `performance_metrics` | Core Web Vitals, TTFB, FCP, LCP, CLS, FID |

### Backup

| Tabelle | Beschreibung |
|---|---|
| `backups` | Vollständige Backups |
| `backup_schedules` | Auto-Backup-Zeitplan |
| `backup_storage_quotas` | Storage-Quota (Standard 1 GB) |
| `backup_checksums` | SHA-256-Checksummen |
| `incremental_backups` | Inkrementelle Backups |
| `realtime_backup_config` | Echtzeit-Backup-Config |
| `restore_jobs` | Restore-Jobs |

### Updates & Plugins

| Tabelle | Beschreibung |
|---|---|
| `site_updates` | Update-History |
| `update_logs` | Schrittweise Update-Logs |
| `plugins` | Verfolgte Plugins |
| `plugin_compatibility` | Kompatibilitätsmatrix |
| `themes` | Verfolgte Themes |
| `wp_users` | Synchronisierte WP-User |

### Staging & Bulk

| Tabelle | Beschreibung |
|---|---|
| `staging_environments` | Staging-Instanzen |
| `staging_sync_jobs` | Push/Pull-Jobs |
| `clone_jobs` | Clone-Jobs |
| `migration_jobs` | Migrations-Jobs |
| `bulk_jobs` | Bulk-Operations |

### Content & Revenue

| Tabelle | Beschreibung |
|---|---|
| `content_projects` | Content-Hub-Projekte |
| `content_posts` | Generierte/veröffentlichte Posts |
| `content_media` | Pexels-Bilder |
| `publish_jobs` | Publishing-Jobs |
| `revenue_snapshots` | WooCommerce-Revenue-Metriken |
| `revenue_correlations` | KI-erkannte Korrelationen |
| `woocommerce_events` | Order/Cart/Refund-Events |

### Teams & Clients

| Tabelle | Beschreibung |
|---|---|
| `teams` | Team-Gruppen |
| `team_members` | Mitgliedschaft & Rollen |
| `team_invites` | Ausstehende Einladungen |
| `team_activity_log` | Audit-Log |
| `white_label_configs` | Branding-Konfiguration |

### Berichte & Benachrichtigungen

| Tabelle | Beschreibung |
|---|---|
| `client_reports` | PDF/HTML-Berichte |
| `scheduled_reports` | Report-Zeitplan |
| `maintenance_reports` | Wartungsberichte |
| `report_schedules` | Automatisierte Zeitpläne |
| `notification_settings` | Kanal-Konfiguration (E-Mail, Slack, Discord, Zapier, Telegram, Webhook) |
| `notification_logs` / `notification_history` | Sendungs-History |
| `zapier_subscriptions` | Zapier-Webhooks |

### Sonstiges

| Tabelle | Beschreibung |
|---|---|
| `site_onboarding_steps` | Onboarding-Schritte |
| `pending_license_requests` | Lizenzanfragen |
| `encrypted_emails` / `email_recovery_exports` | E-Mail-Recovery |

---

## 11. Umgebungsvariablen

### Pflicht

```env
DATABASE_URL       # PostgreSQL-Verbindungsstring
JWT_SECRET         # JWT-Signierschlüssel
```

### Empfohlen

```env
REDIS_HOST / REDIS_PORT / REDIS_PASSWORD / REDIS_DB
ANTHROPIC_API_KEY
SENTRY_DSN
FRONTEND_URL       # https://app.wpma.io
```

### Optional

```env
OPENAI_API_KEY / OPENROUTER_API_KEY / GROQ_API_KEY
STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION / AWS_BACKUP_BUCKET
IDRIVE_E2_ACCESS_KEY_ID / IDRIVE_E2_SECRET_ACCESS_KEY / IDRIVE_E2_BACKUP_BUCKET
PEXELS_API_KEY
DATABASE_SSL / DATABASE_POOL_MAX / DATABASE_IDLE_TIMEOUT / DATABASE_CONNECT_TIMEOUT
```

### Frontend

```env
NEXT_PUBLIC_API_URL   # https://api.wpma.io
```

---

## 12. Docker / Deployment

### Services (`docker-compose.yml`)

| Service | Image | Port | Hinweis |
|---|---|---|---|
| `wpma-postgres` | postgres:16-alpine | `127.0.0.1:5434:5432` | Persistentes Volume |
| `wpma-redis` | redis:7-alpine | `127.0.0.1:6381:6379` | Passwortgeschützt |
| `backend` | Custom Dockerfile | `127.0.0.1:8010:8000` | Abhängig von DB + Redis healthy |
| `frontend` | Custom Dockerfile | `127.0.0.1:3010:3000` | Read-only, 512m Memory |
| `landing` | nginx:alpine | `127.0.0.1:8081:80` | Statisches HTML |

Networks: `proxy-network` (extern, nginx-proxy), `wpma-network` (intern).

**Produktion:** PM2 via `ecosystem.config.js`, Pfad `/var/www/projects/wpma-io-production`, 1 Instanz, max 1 GB Memory.

---

## 13. Dateikonventionen

### Backend (`src/`)

- Sprache: JavaScript (CommonJS, `require`/`module.exports`)
- Routen: `src/routes/<name>.js`
- Controller: `src/controllers/<name>Controller.js`
- Services: `src/services/<name>Service.js`
- Middleware: `src/middleware/<name>.js`
- Config: `src/config/<name>.js`
- Migrationen: `src/migrations/<NNN>_<name>.sql`
- Validierung: Joi-Schema in `src/validators/schemas.js`, angewandt via `validate(schema, 'body'|'params')` Middleware

### Frontend (`wpma-frontend/`)

- Sprache: TypeScript
- Pages: `app/<route>/page.tsx` (immer `'use client'` wenn interaktiv)
- Layouts: `app/<route>/layout.tsx`
- Komponenten: `components/<bereich>/<name>.tsx`
- State: `lib/<name>-store.ts` (Zustand)
- API-Calls: `lib/api.ts` — dort neue API-Funktionen als Export ergänzen
- Typen: Inline-Interfaces in Pages oder `types/api.ts`

### Plugin (`wpma-agent/`)

- Sprache: PHP 7.4+
- Klassen: `includes/class-wpma-<name>.php`
- Admin: `admin/class-wpma-admin.php`, `admin/views/`
- Prefix: `WPMA_` für alle Klassen, Konstanten, Hooks

---

## 14. Serviceabhängigkeiten

```
Browser
  └── Next.js Frontend (app.wpma.io :3010)
        └── Backend API (api.wpma.io :8010)
              ├── PostgreSQL :5434      (primärer Datenspeicher)
              ├── Redis :6381           (Cache, Sessions, Bull-Queue, CORS-Cache)
              ├── WordPress Sites       (HTTP via /wp-json/wpma/v1/*, X-WPMA-Key)
              ├── Anthropic Claude      (KI: Agent, Self-Healing, Insights, Chat)
              ├── OpenAI / Groq         (KI: fallback / alternative Modelle)
              ├── Stripe                (Zahlungen, Webhooks)
              ├── AWS S3 / iDrive E2    (Backup-Storage)
              ├── SMTP                  (E-Mail-Versand)
              └── Pexels API            (Content-Hub: Bilder)
```

---

## 15. Schnellreferenz: Häufige Entwicklungsaufgaben

### Neue Backend-Route

```
1. src/routes/<name>.js erstellen
2. In src/index.js: app.use('/api/v1/<name>', require('./routes/<name>'))
3. Controller in src/controllers/<name>Controller.js
4. authenticateToken aus src/middleware/auth.js verwenden
```

### Neue Frontend-Seite

```
1. wpma-frontend/app/<route>/page.tsx erstellen ('use client')
2. API-Funktion in lib/api.ts ergänzen
3. useQuery (TanStack Query) für Datenabruf
4. useMutation für Schreiboperationen
```

### Neue Datenbanktabelle

```
1. src/migrations/<NNN>_<name>.sql erstellen
2. In src/config/database.js als neuen Migration-Block einbinden
3. SQL: CREATE TABLE IF NOT EXISTS ...
4. Läuft automatisch beim nächsten Server-Start
```

### Plugin-Update

```
1. Version in wpma-agent/wpma-agent.php erhöhen
2. ZIP: zip -r wpma-agent-v<version>.zip wpma-agent/
3. In releases/ ablegen
```
