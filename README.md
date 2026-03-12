# WPMA - WordPress Management AI

KI-gestuetzte Plattform zur zentralen Verwaltung, Ueberwachung und Optimierung von WordPress-Websites.

[![API Status](https://img.shields.io/badge/API-Live-brightgreen)](https://api.wpma.io/health)
[![Dashboard](https://img.shields.io/badge/Dashboard-Live-blue)](https://app.wpma.io)

## Uebersicht

WPMA (WordPress Management AI) ist eine SaaS-Plattform bestehend aus:

- **Dashboard** - Next.js Frontend zur Verwaltung aller WordPress-Sites
- **Backend API** - Node.js/Express API mit KI-Integration
- **WordPress Plugin** - Agent auf jeder verwalteten WordPress-Site

## Features

### Site Management

| Feature | Beschreibung |
|---------|--------------|
| **Multi-Site Dashboard** | Alle WordPress-Sites zentral verwalten |
| **Real-Time Monitoring** | Live-Status via WebSocket |
| **Health Checks** | Automatische Verfuegbarkeitspruefung |
| **Performance Metriken** | Core Web Vitals, TTFB, Ladezeiten |

### Sicherheit

| Feature | Beschreibung |
|---------|--------------|
| **Security Scans** | Automatische Schwachstellen-Erkennung |
| **Malware Detection** | Datei-Integritaetspruefung |
| **Login Protection** | Brute-Force-Schutz |
| **Firewall Rules** | WAF-Integration |

### Backups

| Feature | Beschreibung |
|---------|--------------|
| **Automatische Backups** | Geplante Sicherungen |
| **Inkrementelle Backups** | Nur geaenderte Dateien |
| **Cloud Storage** | AWS S3, Google Cloud, etc. |
| **One-Click Restore** | Einfache Wiederherstellung |

### KI-Features

| Feature | Beschreibung |
|---------|--------------|
| **AI Insights** | Automatische Optimierungsvorschlaege |
| **AI Chat** | Fragen zur Site beantworten |
| **Predictive Analytics** | Probleme vorhersagen |
| **Smart Recommendations** | Plugin/Theme-Empfehlungen |

### Weitere Features

- **Auto-Updates** - WordPress, Plugins, Themes automatisch aktualisieren
- **Bulk Actions** - Aktionen auf mehreren Sites gleichzeitig
- **Staging** - Test-Umgebungen erstellen
- **Team Management** - Benutzer und Rollen verwalten
- **White Label** - Eigenes Branding fuer Agenturen
- **Client Reports** - PDF-Reports fuer Kunden
- **Email Recovery** - Verlorene E-Mails wiederherstellen
- **Notifications** - Push, E-Mail, Slack, Discord

## Architektur

```
                    +------------------+
                    |   Nginx Proxy    |
                    |   (SSL/HTTPS)    |
                    +--------+---------+
                             |
         +-------------------+-------------------+
         |                   |                   |
         v                   v                   v
   +-----------+      +-----------+       +-----------+
   |  Landing  |      |  Frontend |       |  Backend  |
   |  wpma.io  |      |  app.     |       |  api.     |
   |  :80      |      |  :3000    |       |  :8000    |
   +-----------+      +-----------+       +-----+-----+
                                                |
                            +-------------------+-------------------+
                            |                                       |
                            v                                       v
                      +-----------+                          +-----------+
                      | PostgreSQL|                          |   Redis   |
                      |   :5434   |                          |   :6381   |
                      +-----------+                          +-----------+

   +------------------------------------------------------------------+
   |                     WordPress Sites                               |
   |  +-------------+  +-------------+  +-------------+                |
   |  | Site 1      |  | Site 2      |  | Site N      |                |
   |  | WPMA Agent  |  | WPMA Agent  |  | WPMA Agent  |  ...           |
   |  +-------------+  +-------------+  +-------------+                |
   +------------------------------------------------------------------+
```

## Projektstruktur

```
wpma/
+-- src/                      # Backend API
|   +-- index.js              # Express Server
|   +-- routes/
|   |   +-- auth.js           # Authentifizierung
|   |   +-- sites.js          # Site-Verwaltung
|   |   +-- security.js       # Security Scans
|   |   +-- backup.js         # Backup-Management
|   |   +-- performance.js    # Performance-Metriken
|   |   +-- ai.js             # KI-Endpoints
|   |   +-- chat.js           # AI Chat
|   |   +-- monitoring.js     # Live-Monitoring
|   |   +-- updates.js        # Auto-Updates
|   |   +-- bulk.js           # Bulk Actions
|   |   +-- staging.js        # Staging-Umgebungen
|   |   +-- team.js           # Team-Management
|   |   +-- whiteLabel.js     # White-Label
|   |   +-- reports.js        # Client Reports
|   |   +-- notifications.js  # Benachrichtigungen
|   +-- services/
|   |   +-- aiService.js      # OpenAI/Claude Integration
|   |   +-- aiChatService.js  # Chat mit LangChain
|   |   +-- backupService.js
|   |   +-- securityService.js
|   |   +-- performanceService.js
|   |   +-- monitoringService.js
|   |   +-- predictiveService.js
|   |   +-- whiteLabelService.js
|   +-- config/
|   |   +-- database.js       # PostgreSQL
|   |   +-- redis.js          # Redis
|   |   +-- sentry.js         # Error Tracking
|   +-- middleware/
|   +-- jobs/                 # Background Jobs
+-- wpma-frontend/            # Next.js Frontend
|   +-- app/
|   |   +-- dashboard/        # Haupt-Dashboard
|   |   +-- sites/[id]/       # Site-Details
|   |   +-- auth/             # Login/Register
|   +-- components/
|   |   +-- dashboard/
|   |   +-- ui/
|   +-- lib/
|       +-- api.ts            # API Client
|       +-- auth-store.ts     # Zustand Store
+-- wpma-agent/               # WordPress Plugin
|   +-- wpma-agent.php        # Plugin-Hauptdatei
|   +-- includes/
|   |   +-- class-wpma-core.php
|   |   +-- class-wpma-security.php
|   |   +-- class-wpma-backup.php
|   |   +-- class-wpma-performance.php
|   |   +-- class-wpma-api.php
|   |   +-- class-wpma-updates.php
|   +-- admin/
|       +-- class-wpma-admin.php
|       +-- views/
+-- landing/                  # Landing Page
+-- scripts/                  # Deployment Scripts
+-- docker-compose.yml
+-- Dockerfile
```

## Installation

### Voraussetzungen

- Docker & Docker Compose
- Node.js >= 18
- PostgreSQL 16
- Redis 7

### Backend starten

```bash
# Repository klonen
cd /opt/projects/saas-project-1

# Environment konfigurieren
cp env.example .env
# .env bearbeiten und Secrets eintragen

# Dependencies installieren
npm install

# Mit Docker Compose starten
docker-compose up -d

# Oder Entwicklungsserver
npm run dev
```

### Frontend starten

```bash
cd wpma-frontend
npm install
npm run dev
```

### WordPress Plugin installieren

```bash
# Das fertige ZIP verwenden
# wpma-agent-1.2.0.zip

# Oder manuell packen
zip -r wpma-agent.zip wpma-agent/

# In WordPress: Plugins > Installieren > Plugin hochladen
```

## Konfiguration

### Environment Variables

```env
# Server
NODE_ENV=production
PORT=8000

# Datenbank
DATABASE_URL=postgresql://user:pass@localhost:5434/wpma_db
DATABASE_SSL=false
DATABASE_POOL_MAX=20

# Redis
REDIS_HOST=localhost
REDIS_PORT=6381
REDIS_PASSWORD=your-redis-password
REDIS_DB=3

# JWT
JWT_SECRET=your-jwt-secret

# Frontend
FRONTEND_URL=https://app.wpma.io

# KI Services (optional)
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=...
ANTHROPIC_API_KEY=...

# Payments (optional)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Monitoring (optional)
SENTRY_DSN=https://...@sentry.io/...

# E-Mail (optional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
```

## API-Dokumentation

**Base URL:** `https://api.wpma.io/api/v1`

### Authentifizierung

```bash
# Login
curl -X POST https://api.wpma.io/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "..."}'

# Response: { "token": "eyJ...", "user": {...} }
```

### Sites

```bash
# Alle Sites abrufen
curl https://api.wpma.io/api/v1/sites \
  -H "Authorization: Bearer YOUR_TOKEN"

# Site hinzufuegen
curl -X POST https://api.wpma.io/api/v1/sites \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"url": "https://example.com", "name": "My Site"}'
```

### Security Scan

```bash
curl -X POST https://api.wpma.io/api/v1/security/scan \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"site_id": "uuid"}'
```

### Backup

```bash
# Backup erstellen
curl -X POST https://api.wpma.io/api/v1/backup/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"site_id": "uuid", "type": "full"}'
```

### AI Chat

```bash
curl -X POST https://api.wpma.io/api/v1/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"site_id": "uuid", "message": "Warum ist meine Site langsam?"}'
```

## WordPress Plugin

### Setup

Nach Installation des Plugins:

1. **API-Key eingeben** - Von app.wpma.io kopieren
2. **Verbindung testen** - Button im Plugin-Dashboard
3. **Automatisch verbunden** - Site erscheint im Dashboard

### Plugin-Features

- Sendet Health-Daten stuendlich
- Fuehrt Security-Scans durch
- Erstellt Backups auf Anfrage
- Sammelt Performance-Metriken
- Fuehrt Updates aus (wenn aktiviert)

### Cron Jobs

| Job | Intervall | Beschreibung |
|-----|-----------|--------------|
| `wpma_health_check` | Stuendlich | Status an API senden |
| `wpma_security_scan` | Taeglich | Security-Scan durchfuehren |
| `wpma_backup_check` | Taeglich | Backup-Status pruefen |
| `wpma_performance_check` | Stuendlich | Performance-Daten senden |

## Scripts

```bash
# Backend
npm run dev              # Entwicklungsserver
npm run start            # Produktionsserver
npm run test             # Tests ausfuehren
npm run migrate          # Datenbank-Migration

# Frontend
cd wpma-frontend
npm run dev              # Next.js Dev Server
npm run build            # Production Build
npm run start            # Production Server

# Docker
docker-compose up -d     # Alle Services starten
docker-compose logs -f   # Logs anzeigen
docker-compose down      # Stoppen

# Deployment
./scripts/deploy-production.sh
./scripts/generate-secrets.sh
```

## Tech-Stack

**Backend:**
- Node.js / Express 5
- PostgreSQL 16
- Redis 7
- Socket.IO (Real-Time)
- Bull (Job Queue)

**Frontend:**
- Next.js 15 (Turbopack)
- React 19
- TailwindCSS
- Zustand (State)
- React Query
- Recharts / Chart.js

**KI:**
- OpenAI GPT-4
- Anthropic Claude
- LangChain

**WordPress:**
- PHP 7.4+
- WordPress 5.8+

**Infrastruktur:**
- Docker
- Nginx
- Let's Encrypt
- Sentry

## Ports

| Service | Port | Beschreibung |
|---------|------|--------------|
| Backend API | 8000 | Express Server |
| Frontend | 3000 | Next.js |
| PostgreSQL | 5434 | Datenbank |
| Redis | 6381 | Cache & Queue |

## WebSocket Events

```javascript
// Client
socket.emit('join_user_room', userId);

// Server -> Client
socket.emit('site_status_update', { siteId, status });
socket.emit('backup_progress', { siteId, progress });
socket.emit('scan_complete', { siteId, results });
socket.emit('notification', { type, message });
```

## Links

| Service | URL |
|---------|-----|
| Landing | https://wpma.io |
| Dashboard | https://app.wpma.io |
| API | https://api.wpma.io |
| Health Check | https://api.wpma.io/health |

## Lizenz

MIT License - WPMA.io Team
