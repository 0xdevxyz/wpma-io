# WPMA.io — Technical Debt Elimination

## What This Is

WPMA.io is a WordPress management SaaS platform (Node.js/Express backend, Next.js 15 frontend) that handles site monitoring, backups, security scans, performance, content publishing, AI insights, team collaboration, and white-label billing. This milestone addresses 15 identified technical concerns across security, reliability, maintainability, and test coverage.

## Core Value

The platform must be stable and trustworthy enough for production customers to rely on — security gaps, silent failures, and schema drift are existential risks that block growth.

## Requirements

### Validated

- ✓ Auth (JWT login/register/refresh) — existing
- ✓ Site management (WordPress REST API integration) — existing
- ✓ Backup management (S3/B2/local) — existing
- ✓ Security scanning — existing
- ✓ Performance monitoring — existing
- ✓ Content Publishing Hub (Claude generation + Pexels + WP publish) — existing
- ✓ AI insights and agent chat — existing
- ✓ Team collaboration + white-label — existing
- ✓ Billing (Stripe) — existing
- ✓ Notifications (Slack/Discord/Zapier) — existing
- ✓ Staging and auto-updates — existing

### Active

- [ ] Eliminate `env.production` secrets exposure from repo
- [ ] Standardize `getUserId` to single JWT claim form
- [ ] Add test coverage for critical backend services and routes
- [ ] Resolve mixed controller pattern (inline vs controller)
- [ ] Document canonical DB schema (replace ad-hoc migration sprawl)
- [ ] Review and harden Bull queue dead-letter / failure handling
- [ ] Verify Socket.io connections require authenticated JWT
- [ ] Add OpenAPI types or response typing to frontend API client
- [ ] Evaluate LLM fallback chain reliability and add observability
- [ ] Clean up root-level markdown doc sprawl
- [ ] Remove binary agent zips from git, move to releases
- [ ] Track and assess `server-check.sh` untracked script
- [ ] Validate Next.js read-only + tmpfs behavior in Docker
- [ ] Harden HMAC replay window with clock-drift tolerance notes
- [ ] Add frontend E2E test scaffolding (Playwright)

### Out of Scope

- New features — this milestone is debt-only; no new product capabilities
- Full test suite (100% coverage) — targeted critical path coverage only
- OpenAPI spec generation tooling — manual type improvements are sufficient for now

## Context

Codebase map completed 2026-03-29. 15 concerns identified across Critical, High, Medium, and Low priority categories. The codebase is a production system with paying customers — changes must be safe and incremental. Key risk areas: secrets in repo (#5), unauthenticated WebSocket (#10), silent job failures (#9), and schema drift (#6).

## Constraints

- **Tech Stack**: Node.js/Express backend, Next.js 15 frontend — no runtime changes
- **Safety**: All changes must be backward-compatible; no breaking API changes
- **Secrets**: `env.production` must be handled carefully — do not delete blindly, verify first
- **Database**: Schema changes require migrations, not direct edits

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Coarse granularity | 15 concerns group naturally into 3-5 thematic phases | — Pending |
| Fix getUserId via middleware, not search/replace | Centralized fix is safer than touching 35+ files | — Pending |
| Targeted tests, not full coverage | Time-boxed; focus on regressions most likely to hurt | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-29 after initialization*
