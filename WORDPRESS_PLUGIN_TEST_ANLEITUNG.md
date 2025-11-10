# WordPress Plugin Test-Anleitung

## ✅ Backend ist bereit!

Alle Backend-Services laufen und sind einsatzbereit:
- **Backend API:** https://api.wpma.io (Port 8000)
- **PostgreSQL:** wpma-postgres (Port 5434)
- **Redis:** wpma-redis (Port 6381)
- **Frontend:** https://app.wpma.io
- **Landing:** https://wpma.io

## 📦 Plugin-Installation

### 1. Plugin hochladen

**Option A: ZIP-Upload (empfohlen)**
1. Im WordPress Admin-Bereich: `Plugins > Installieren > Plugin hochladen`
2. Datei auswählen: `/opt/projects/saas-project-1/wpma-agent-plugin.zip` (17KB)
3. "Jetzt installieren" klicken
4. Plugin aktivieren

**Option B: FTP/SFTP Upload**
1. Gesamten Ordner `/opt/projects/saas-project-1/wpma-agent/` hochladen
2. Nach `wp-content/plugins/wpma-agent/`
3. Im WordPress Admin aktivieren

### 2. Plugin konfigurieren

Nach der Aktivierung gibt es zwei Optionen:

**Option A: Manuelle Konfiguration**
1. Im WordPress Admin: `WPMA Agent > Einstellungen`
2. API-Key eingeben: `wpma_test_25c3fc68d53cbfd8ae36a08d12691af0`
3. API-URL ist bereits vorkonfiguriert: `https://api.wpma.io`
4. "Einstellungen speichern"

**Option B: Automatische Konfiguration (wenn Setup-Token vorhanden)**
- Das Plugin versucht automatisch die Konfiguration beim Aktivieren

## 🧪 Tests durchführen

### Test 1: Performance-Tracking

**Im WordPress-Backend:**
1. Öffnen Sie Ihre Website im Frontend (beliebige Seite)
2. Die Core Web Vitals werden automatisch im Hintergrund erfasst
3. Im WordPress Admin: `WPMA Agent > Performance` - prüfen Sie ob Daten angezeigt werden

**Backend API prüfen:**
```bash
# Performance-Metriken abrufen (Site-ID ist 1)
curl -s "http://localhost:8000/api/v1/performance/1/metrics?limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" | jq .
```

**Frontend Dashboard prüfen:**
1. Öffnen Sie: https://app.wpma.io
2. Login (falls erforderlich)
3. Navigieren zu: Performance-Dashboard der Test-Site
4. Prüfen Sie ob Metriken sichtbar sind

**Erwartete Metriken:**
- Page Load Time (ms)
- Core Web Vitals (LCP, FID, CLS)
- Memory Usage
- Database Queries
- Cache Hit Ratio

### Test 2: Security-Scanning

**Manuellen Scan triggern:**
1. Im WordPress Admin: `WPMA Agent > Security`
2. Button "Jetzt scannen" klicken
3. Warten Sie ca. 10-15 Sekunden
4. Scan-Ergebnisse sollten angezeigt werden

**Backend API prüfen:**
```bash
# Security-Scans abrufen
curl -s "http://localhost:8000/api/v1/security/1/status" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" | jq .
```

**Erwartete Scan-Ergebnisse:**
- Security Score (0-100)
- SSL-Status
- Debug-Modus Status
- Veraltete Plugins/Themes
- Dateirechte-Prüfung
- Schwachstellen-Liste

### Test 3: Cron-Jobs verifizieren

**Im WordPress:**
```php
// In wp-admin/tools.php oder über Plugin
wp_cron_info(); // Wenn Plugin installiert
```

**Oder via WP-CLI:**
```bash
wp cron event list | grep wpma
```

**Erwartete Cron-Jobs:**
- `wpma_health_check` - Stündlich
- `wpma_security_scan` - Täglich
- `wpma_backup_check` - Täglich
- `wpma_performance_check` - Stündlich

**Logs prüfen:**
```bash
# Backend-Logs überwachen
docker logs wpma-backend -f

# Nach ca. 1 Stunde sollten Sie sehen:
# "[Job] Running uptime checks..."
# "[Job] Running performance checks..."
```

### Test 4: Real-Time Updates

**Performance-Metriken in Echtzeit:**
1. Öffnen Sie das Frontend-Dashboard (Performance-Seite)
2. Laden Sie mehrere Seiten Ihrer WordPress-Site
3. Die Metriken sollten sich im Dashboard aktualisieren
4. Der Chart sollte neue Datenpunkte zeigen

### Test 5: API-Kommunikation

**WordPress → Backend:**
```bash
# In WordPress Debug-Log prüfen (wp-config.php: define('WP_DEBUG_LOG', true))
tail -f wp-content/debug.log | grep WPMA
```

**Backend-Logs:**
```bash
docker logs wpma-backend -f | grep "performance\|security"
```

**Erwartete Log-Einträge:**
- "POST /api/v1/performance/:siteId/metrics - 200"
- "POST /api/v1/security/:siteId/scan - 200"

## 📊 Test-Daten

**Test-Site Details:**
- Site-ID: `1`
- API-Key: `wpma_test_25c3fc68d53cbfd8ae36a08d12691af0`
- Domain: `test-wordpress.local`
- User: `test@wpma.io`

## ✅ Erfolgs-Kriterien

### Minimum für Production-Ready:
- [ ] Plugin lässt sich installieren und aktivieren
- [ ] API-Key Konfiguration funktioniert
- [ ] Performance-Metriken werden gesammelt
- [ ] Security-Scan liefert Ergebnisse
- [ ] Cron-Jobs sind registriert
- [ ] Backend empfängt Daten vom Plugin
- [ ] Frontend-Dashboard zeigt Daten an

### Optional (Nice-to-Have):
- [ ] Real-Time Updates im Frontend
- [ ] E-Mail-Benachrichtigungen bei Problemen
- [ ] AI-Empfehlungen werden generiert
- [ ] Automatische Problembehebung

## 🔧 Troubleshooting

### Plugin sendet keine Daten

**Prüfen Sie:**
```bash
# API erreichbar?
curl -I https://api.wpma.io/health

# WordPress kann Backend erreichen?
# In WordPress: Tools > Site Health > Info > Server
```

**Fix:**
- Prüfen Sie Firewall-Regeln
- Prüfen Sie SSL-Zertifikat
- In wp-config.php temporär: `define('WP_HTTP_BLOCK_EXTERNAL', false);`

### Cron-Jobs laufen nicht

**Manuell triggern:**
```bash
wp cron event run wpma_performance_check
```

**Alternative:** Echte Cron statt WP-Cron:
```bash
# In wp-config.php:
define('DISABLE_WP_CRON', true);

# In Crontab:
*/5 * * * * curl https://ihre-site.de/wp-cron.php?doing_wp_cron
```

### Backend-Logs zeigen Fehler

```bash
# Container-Status prüfen
docker ps | grep wpma

# Logs ansehen
docker logs wpma-backend --tail 100

# Datenbank-Verbindung testen
docker exec wpma-backend node -e "
  const {pool} = require('./src/config/database');
  pool.query('SELECT NOW()').then(r => console.log('DB OK:', r.rows[0]));
"
```

## 📝 Test-Protokoll

Bitte dokumentieren Sie Ihre Tests:

```markdown
### Performance-Test
- [ ] Plugin installiert: ✅/❌
- [ ] Metriken gesammelt: ✅/❌
- [ ] Backend empfängt Daten: ✅/❌
- [ ] Frontend zeigt Daten: ✅/❌
- **Notizen:** 

### Security-Test
- [ ] Scan durchgeführt: ✅/❌
- [ ] Ergebnisse sichtbar: ✅/❌
- [ ] Schwachstellen erkannt: ✅/❌
- **Notizen:**

### Cron-Jobs
- [ ] Jobs registriert: ✅/❌
- [ ] Jobs laufen: ✅/❌
- **Notizen:**
```

## 🚀 Nächste Schritte nach erfolgreichem Test

1. Plugin-ZIP für Production vorbereiten
2. End-to-End User-Flow testen
3. Production-Readiness Checklist durchgehen
4. Live-Deployment planen

---

**Erstellt:** 2025-11-10
**Backend-Version:** 1.0.0
**Plugin-Version:** 1.0.0
**Status:** Ready for Testing

