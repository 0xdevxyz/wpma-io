# WPMA.io — Ziele & Entwicklungs-Workflow

> Stand: April 2026 | Quelle: Direkt aus dem Code gelesen.

---

## 1. Produktziel

**WPMA ist eine KI-gestützte WordPress-Management-Plattform für Agenturen.**

Der KI-Agent ist das Herzstück: Er scannt alle Sites alle 15 Minuten automatisch, erstellt Tasks, führt per Auto-Approve-Level Aktionen selbstständig aus und wartet bei kritischen Eingriffen auf manuelle Freigabe im Dashboard.

**Was bereits vollständig implementiert ist (aus Code verifiziert):**
- Autonomer KI-Agent mit Task-Queue, Approve/Reject, Manual-Mode, konfigurierbaren Auto-Approve-Levels (low/medium/high/critical)
- Self-Healing: Analyse, Apply-Fix, Auto-Heal (WP Plugin triggert direkt)
- Staging: Create, Push/Pull, Clone, Migrate
- Rollback: eigene Route und Controller
- Backup: Full + Inkrementell + Scheduling + Quota + Checksums
- Security: Scans, Vulnerability-Alerts mit KI-Score, SSL-Checks
- Performance: Core Web Vitals, TTFB, FCP, LCP, CLS, FID
- Monitoring: Uptime-Checks alle 5 Min, Incidents
- Plugin-Management: List, Install, Toggle, Update, Delete
- Theme-Management: List, Install, Activate, Update, Delete
- Bulk-Operations: Updates, Backups, Plugin-Install/Deactivate, Security-Scan, Job-Tracking
- Content-Hub: Projekte, Posts generieren, Pexels-Media, Publishing
- WooCommerce Revenue: Snapshots, Events, Korrelationen, KI-Analyse
- Client-Portal: eigener JWT, Sites-Ansicht für Kunden
- Team-Management, White-Label, Notifications (Slack, Discord, Zapier, Telegram, Webhook)
- Berichte: Client-Reports (PDF), Maintenance-Reports, Scheduling
- E-Mail-Recovery, Broken-Links, WP-User-Verwaltung
- Onboarding, Zahlungen (Stripe), Real-time via Socket.IO

**Zielgruppe:** WordPress-Agenturen, die mehr als 10 Sites verwalten.

---

## 2. Bekannte Bugs (aus Code-Analyse, höchste Priorität)

| Bug | Datei | Problem |
|---|---|---|
| Route-Konflikt | `src/index.js` | `/reports` zweimal gemountet (`reports.js` + `maintenanceReports.js`) — zweiter Mount überschreibt ersten |
| Unmounted Route | `src/routes/emailEncryption.js` | Datei existiert, nicht in `index.js` eingebunden |
| Doppeltes JSX | `components/dashboard/agent-live-panel.tsx` | Active-Tasks-Block doppelt gerendert (Zeilen ~211-260) |
| Plugin Auth-Inkonsistenz | `wpma-agent/includes/class-wpma-rest-api.php` | Nutzt `X-WPMA-API-Key`; Haupt-Plugin nutzt `X-WPMA-Key`; `/wp-json/wpma/v1/plugins` in beiden registriert |

---

## 3. Offene Baustellen (aus Code-Analyse)

Was noch fehlt oder unvollständig ist:

| Bereich | Was fehlt |
|---|---|
| `sites/[id]` | Kein dedizierter "Overview"-Tab mit WP-Stats (DB-Größe, User-Count, Post-Count) aus dem Plugin — das `sites/[id]/page.tsx` zeigt Health/Performance/Security/Backups, aber zieht die Plugin-Stats nicht vollständig aus `/wp-json/wpma/v1/stats` |
| `wp-users` | Route `GET /api/v1/wp-users/:siteId` ist implementiert, aber es fehlen `POST` (User anlegen), `PUT` (User editieren), `DELETE` (User löschen) im Controller |
| Revenue | `POST /revenue/:siteId/snapshot` und `/event` haben **kein Auth** — jeder kann Daten pushen |
| Plugin Sync | `wpma-agent.php` registriert `/wp-json/wpma/v1/plugins` UND `class-wpma-rest-api.php` registriert dieselbe Route — WP überschreibt eine davon |
| `emailEncryption.js` | Route-Datei existiert, ist aber nie gemountet |

---

## 4. Entwicklungs-Workflow

### Grundregeln

1. **Code lesen, nicht raten** — vor jeder Änderung die betroffene Datei öffnen und lesen
2. **`ARCHITECTURE.md` ist die Wahrheit** — dort stehen alle Routen, Tabellen, Komponenten wie sie wirklich existieren
3. **Backend vor Frontend** — API-Route muss existieren und funktionieren, bevor das UI gebaut wird
4. **Migrationen per SQL-Datei** — neue Tabellen als `src/migrations/<NNN>_<name>.sql`, dann in `src/config/database.js` einbinden
5. **Nach jeder größeren Änderung** — `ARCHITECTURE.md` aktualisieren

### Neues Feature implementieren

```
1. Betroffene Route-Datei in src/routes/ lesen
2. Controller in src/controllers/ lesen
3. Backend-Änderung implementieren
4. Falls neue DB-Tabelle: src/migrations/<NNN>_name.sql + database.js einbinden
5. Falls Route neu: in src/index.js mounten
6. Frontend: lib/api.ts ergänzen
7. Frontend: page.tsx mit useQuery/useMutation implementieren
```

### Bug fixen

```
1. Exakten Fehler reproduzieren
2. Root Cause im Code finden (nicht Symptom behandeln)
3. Nur die betroffene Stelle ändern
4. Testen
```

### Plugin-Update deployen

```
1. Änderung in wpma-agent/ durchführen
2. Version in wpma-agent/wpma-agent.php erhöhen
3. ZIP: zip -r wpma-agent-v<version>.zip wpma-agent/
4. In releases/ ablegen
```

### Deployment (Produktion)

```bash
git push origin main
# auf Server: PM2 via ecosystem.config.js
# oder: docker-compose -f docker-compose.prod.yml up -d --build
```

---

## 5. Dateikonventionen (Kurzreferenz)

### Backend (`src/`)

| Typ | Pfad | Sprache |
|---|---|---|
| Einstiegspunkt | `src/index.js` | JS (CommonJS) |
| Routen | `src/routes/<name>.js` | JS |
| Controller | `src/controllers/<name>Controller.js` | JS |
| Services | `src/services/<name>Service.js` | JS |
| Middleware | `src/middleware/<name>.js` | JS |
| Config | `src/config/<name>.js` | JS |
| Migrationen | `src/migrations/<NNN>_<name>.sql` | SQL |
| Validierung | Joi-Schema in `src/validators/schemas.js`, via `validate(schema, 'body'|'params')` |

### Frontend (`wpma-frontend/`)

| Typ | Pfad | Sprache |
|---|---|---|
| Pages | `app/<route>/page.tsx` | TypeScript (`'use client'`) |
| Layouts | `app/<route>/layout.tsx` | TypeScript |
| Komponenten | `components/<bereich>/<name>.tsx` | TypeScript |
| API-Calls | `lib/api.ts` | TypeScript |
| State | `lib/<name>-store.ts` | Zustand + persist |
| Typen | `types/api.ts` oder inline | TypeScript |

**Pattern für API-Calls in Pages:**
```tsx
const { data } = useQuery({ queryKey: ['key'], queryFn: () => api.get(...) })
const mutation = useMutation({ mutationFn: (data) => api.post(...) })
```

### Plugin (`wpma-agent/`)

| Typ | Pfad |
|---|---|
| Haupt-Plugin | `wpma-agent.php` |
| Klassen | `includes/class-wpma-<name>.php` |
| Admin | `admin/class-wpma-admin.php` |
| Views | `admin/views/` |
| Prefix | `WPMA_` für alle Klassen, Konstanten, Hooks |

---

## 6. Neue DB-Tabelle hinzufügen

1. SQL-Datei erstellen: `src/migrations/<NNN>_<name>.sql`
```sql
CREATE TABLE IF NOT EXISTS <name> (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ...
  created_at TIMESTAMP DEFAULT NOW()
);
```

2. In `src/config/database.js` als Migration-Block einbinden:
```js
try {
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/<NNN>_<name>.sql'), 'utf8');
  for (const stmt of sql.split(';').map(s => s.trim()).filter(s => s.length && !s.startsWith('--'))) {
    await pool.query(stmt);
  }
  console.log('Migration <NNN> completed');
} catch (e) { console.error('Migration <NNN>:', e.message); }
```

Läuft automatisch beim nächsten Server-Start.

---

## 7. KI-Kontext-Regeln

Da das System zu groß für einen einzelnen Kontext ist:

- **Vor jeder Session:** `ARCHITECTURE.md` + `GOALS_AND_WORKFLOW.md` lesen
- **Bei Routen-Fragen:** Sektion 5 in `ARCHITECTURE.md`
- **Bei DB-Fragen:** Sektion 10 in `ARCHITECTURE.md`
- **Bei Feature-Entscheidungen:** Diese Datei (Sektion 3: Offene Baustellen)
- **Nach Änderungen:** `ARCHITECTURE.md` Sektion 5, 8 oder 10 aktualisieren je nach Art der Änderung
- **Nie aus alten Docs schließen** — immer den echten Code lesen
