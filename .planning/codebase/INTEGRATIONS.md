# INTEGRATIONS.md — External Services & APIs

## Database

| Service | Version | Config |
|---------|---------|--------|
| PostgreSQL | 16 | `src/config/database.js` — `Pool` via `DATABASE_URL` |
| Redis | 7 | `src/config/redis.js` — `REDIS_HOST/PORT/PASSWORD` |

- DB accessed via `const { query } = require('../config/database')`
- Redis used for: JWT blacklisting, Bull queues, caching

## Authentication

- **JWT** (`jsonwebtoken`) — Bearer tokens in `Authorization` header
- **Token blacklist** — Redis key `blacklist:{token}` on logout
- **WordPress plugin auth** — API key per site, rate-limited (30/15min)

## AI / LLM Providers

| Provider | SDK | Purpose | Env Var |
|----------|-----|---------|---------|
| Anthropic | `@anthropic-ai/sdk` | Content generation, AI insights | `ANTHROPIC_API_KEY` |
| OpenAI | `openai` | Fallback LLM | `OPENAI_API_KEY` |
| Groq | via OpenAI-compatible | Primary LLM (Llama 3.3 70B) | `GROQ_API_KEY` |
| OpenRouter | HTTP | LLM fallback | `OPENROUTER_API_KEY` |
| Pexels | REST v1 | Stock media for Content Hub | `PEXELS_API_KEY` |

LLM priority in `src/services/llmService.js`: Groq → Anthropic → OpenRouter

## Payment

- **Stripe** — `stripe` SDK, `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
- Routes: `src/routes/payment.js`
- Service: `src/services/paymentService.js`

## Object Storage (Backups)

| Provider | SDK | Config |
|----------|-----|--------|
| AWS S3 | `aws-sdk` | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BACKUP_BUCKET` |
| iDrive E2 | `aws-sdk` (S3-compat) | `IDRIVE_E2_ACCESS_KEY`, `IDRIVE_E2_SECRET_KEY`, `IDRIVE_E2_ENDPOINT`, `IDRIVE_E2_BUCKET` |

## Email

- **SMTP** via `nodemailer`
- Config: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- Service: `src/services/emailService.js`

## Error Monitoring

- **Sentry** — `@sentry/node`, config: `src/config/sentry.js`
- Env: `SENTRY_DSN`

## Real-time / WebSocket

- **Socket.io** — bidirectional events (monitoring, AI agent live panel)
- Initialized in `src/index.js`, passed to services

## WordPress Sites (Managed)

- HTTP calls via `axios` to WP REST API on managed sites
- Application Password auth per site
- Health/status polling via `src/services/healthCheckService.js`
- Agent plugin receives signed webhooks: HMAC-SHA256 (`X-WPMA-Signature: sha256=<hex>`)

## External Webhooks / Notifications

| Type | Service | File |
|------|---------|------|
| Slack | Incoming Webhooks | `src/services/notificationService.js` |
| Discord | Webhooks | `src/services/notificationService.js` |
| Zapier | Webhooks | `src/services/notificationService.js` |

## CDN / Proxy

- **Nginx** — Reverse proxy (production), managed via `/etc/nginx/sites-enabled`
- **Docker** — `proxy-network` for nginx-proxy with Let's Encrypt
- Domains: `api.wpma.io` (backend), `app.wpma.io` (frontend), `wpma.io` (landing)
