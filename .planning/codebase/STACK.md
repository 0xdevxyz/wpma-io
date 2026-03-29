# STACK.md — Technology Stack

## Runtime & Language

- **Backend**: Node.js (CommonJS), Express 5
- **Frontend**: Next.js 15 (App Router), TypeScript, React 19
- **WordPress Agent**: PHP (standalone plugin)

## Backend Dependencies

### Core Framework
- `express` ^5.1.0 — HTTP server
- `cors`, `helmet` — Security middleware
- `express-rate-limit` ^7.5.1 — Rate limiting

### Database & Cache
- `pg` ^8.16.3 — PostgreSQL 16 client (connection pool via `Pool`)
- `redis` ^5.6.0 — Redis 7 client

### Authentication & Security
- `jsonwebtoken` ^9.0.2 — JWT auth
- `bcryptjs` ^3.0.2 — Password hashing
- `joi` ^17.13.3 — Request validation

### AI / LLM
- `@anthropic-ai/sdk` ^0.71.0 — Claude (claude-sonnet-4-6 for content, claude-3-haiku for analysis)
- `openai` ^5.8.3 — OpenAI fallback
- `langchain` ^0.3.29 — LLM orchestration
- LLM priority: Groq → Anthropic → OpenRouter (via `llmService.js`)

### Background Jobs
- `bull` ^4.16.5 — Redis-backed job queues
- `node-cron` ^4.2.0 — Scheduled tasks

### Storage & Backups
- `aws-sdk` ^2.1692.0 — S3 / iDrive E2 compatible object storage
- `archiver` ^7.0.1, `adm-zip` ^0.5.16 — Zip/archive handling
- `multer` ^1.4.5-lts.1 — File uploads

### External Integrations
- `stripe` ^18.3.0 — Payments
- `nodemailer` ^8.0.1 — Email (SMTP)
- `socket.io` ^4.7.2 — WebSocket real-time
- `pdfkit` ^0.17.2 — PDF report generation
- `cheerio` ^1.0.0-rc.12 — HTML scraping (WP health checks)
- `axios` ^1.10.0 — HTTP requests to WP sites
- `@sentry/node` ^9.36.0 — Error monitoring

### Logging
- `winston` ^3.17.0 — Structured logging

## Frontend Dependencies

### Framework
- `next` ^15.5.14, `react` ^19.0.0 — App Router, SSR/RSC

### State Management
- `zustand` ^5.0.6 — Global state
- `@tanstack/react-query` ^5.82.0 — Server state / caching

### UI
- Tailwind CSS ^3.4.1 — Utility-first CSS
- `lucide-react` ^0.525.0 — Icon library
- `framer-motion` ^12.23.1 — Animations
- `react-hot-toast` ^2.5.2 — Notifications
- `clsx` — Class conditionals

### Charts
- `recharts` ^3.1.0, `chart.js` ^4.4.1, `react-chartjs-2` ^5.2.0

### Forms
- `react-hook-form` ^7.60.0

### Real-time
- `socket.io-client` ^4.8.1

### HTTP
- `axios` ^1.10.0

## Build & Dev Tools

- **Backend**: `nodemon`, `eslint`, `jest` ^30.0.4, `supertest`
- **Frontend**: TypeScript ^5, ESLint (Next config)
- **Containerization**: Docker, Docker Compose

## Configuration Files

- `package.json` — Backend deps at `/package.json`
- `wpma-frontend/package.json` — Frontend deps
- `jest.config.js` — Jest with node env, 50% coverage threshold
- `ecosystem.config.js` — PM2 config
- `docker-compose.yml` — Multi-service compose
- `docker-compose.prod.yml` — Production overrides
- `env.example` — Environment variable template
- `env.secure.template` — Secure config template
