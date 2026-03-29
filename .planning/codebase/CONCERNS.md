# CONCERNS.md — Technical Debt & Areas of Concern

## Critical

### 1. Minimal Test Coverage
- Only 3 test files for 35+ services and 34 routes
- No frontend tests at all
- No API integration tests
- High risk: regressions go undetected
- Files: `src/__tests__/services/securityService.test.js`, `performanceService.test.js`

### 2. Mixed Controller Pattern
- Most routes call services directly from route handlers (inline logic)
- `src/routes/sites.js` uses a dedicated `src/controllers/sitesController.js`
- Inconsistency makes the codebase harder to navigate and test
- No clear convention for when to use a controller vs inline

### 3. Massive Number of Markdown Docs in Root
- 25+ `.md` files in project root (`DEPLOYMENT_COMPLETE.md`, `LIVE_STATUS_REPORT.md`, etc.)
- Mix of reports, logs, and guides — not organized
- Suggests ad-hoc documentation during development sprints

## High Priority

### 4. Dual getUserId Pattern
- `req.user?.userId || req.user?.id` used throughout
- Both `userId` and `id` exist as JWT claim names
- Should be standardized to one form in the JWT payload

### 5. `env.production` File in Repo
- File `env.production` is present at project root
- If this contains real secrets, it must not be committed
- Should be in `.gitignore` or replaced with secret management

### 6. Large Migration File Set Without Schema Doc
- 14+ migration SQL files including ad-hoc files (`add_missing_tables.sql`, `add_selfhealing_staging_rollback.sql`)
- No single source-of-truth schema document
- Mix of numbered migrations and descriptively named ad-hoc files
- Risk: schema drift between environments

### 7. LLM Fallback Chain Complexity
- 3-provider fallback: Groq → Anthropic → OpenRouter
- `src/services/llmService.js` manages this
- Failure modes and retry logic need review
- No clear monitoring of which provider is being used

## Medium Priority

### 8. Frontend API Client Type Safety
- `wpma-frontend/lib/api.ts` is the central API client
- Return types likely `any` for many endpoints — needs type coverage review
- No OpenAPI/Swagger spec to generate types from

### 9. Bull Queue Error Handling
- Background jobs via `bull` — no visible dead-letter queue strategy
- Failed jobs may silently fail
- `src/services/jobService.js` needs review

### 10. Socket.io Authentication
- Real-time WS connection — unclear if socket connections are authenticated with same JWT
- Could allow unauthorized WS connections

### 11. HMAC Replay Window
- 120s replay protection for WP agent webhooks
- Depends on clock sync between server and WP sites
- NTP drift on shared hosting could cause false rejections

## Low Priority

### 12. `wpma-agent-1.4.2.zip` and `wpma-agent.zip` in Repo Root
- Binary files committed to git root
- Should be in releases or excluded from the repo

### 13. `server-check.sh` Untracked
- Untracked shell script in repo root
- Purpose unclear — may contain hardcoded values or credentials

### 14. Frontend `read_only: true` + tmpfs
- `docker-compose.yml` runs frontend with read-only filesystem and tmpfs
- Good security posture, but Next.js caching/build cache behavior needs validation in this mode

### 15. No Frontend E2E Tests
- No Playwright or Cypress detected
- User flows (login, site add, backup trigger) untested end-to-end
