# WPMA Plugin Update - Version 1.4.0

## 🚨 WICHTIG: Plugin-Update erforderlich!

Das Problem mit "0 / 0" Plugins ist jetzt gelöst!

## Was war das Problem?

Das Plugin hat die Daten AN das Dashboard gesendet, aber **keine REST API Endpoints** bereitgestellt, damit das Dashboard die Daten ABRUFEN kann.

## Was ist neu in Version 1.4.0?

### ✅ Neue REST API Endpoints:

1. **GET `/wp-json/wpma/v1/plugins`**
   - Liefert alle installierten Plugins
   - Zeigt aktive Status und verfügbare Updates

2. **GET `/wp-json/wpma/v1/themes`**
   - Liefert alle installierten Themes
   - Zeigt aktives Theme und Updates

3. **GET `/wp-json/wpma/v1/stats`**
   - Site-Statistiken: Posts, Pages, Comments, Users
   - Disk Usage

4. **GET `/wp-json/wpma/v1/core-update`**
   - WordPress Core Update Status
   - PHP & MySQL Version

5. **GET `/wp-json/wpma/v1/security-check`**
   - Basic Security Checks
   - SSL Status, Plugin Updates, Berechtigungen

6. **GET `/wp-json/wpma/v1/performance`**
   - Performance Metriken
   - Memory Usage, DB Queries, DB Size

### 🔐 Sicherheit:
- Alle Endpoints sind mit API-Key geschützt
- Nur autorisierte Requests werden beantwortet

---

## Installation

### Option 1: Plugin-Update (Empfohlen)

1. **Alte Version deaktivieren:**
   ```
   WordPress Admin → Plugins → WPMA Agent → Deaktivieren
   ```

2. **Alte Version löschen:**
   ```
   WordPress Admin → Plugins → WPMA Agent → Löschen
   ```

3. **Neue Version hochladen:**
   ```
   WordPress Admin → Plugins → Installieren → Plugin hochladen
   Datei: wpma-agent-1.4.0.zip
   ```

4. **Plugin aktivieren:**
   ```
   Klicke auf "Plugin aktivieren"
   ```

5. **API-Key ist noch gespeichert:**
   - Dein API-Key bleibt erhalten
   - Keine Neukon figuration erforderlich

### Option 2: FTP-Upload

1. **Altes Plugin löschen:**
   ```
   Per FTP: /wp-content/plugins/wpma-agent/ löschen
   ```

2. **Neues Plugin hochladen:**
   ```
   wpma-agent-1.4.0.zip entpacken
   Ordner wpma-agent/ per FTP nach /wp-content/plugins/ hochladen
   ```

3. **Plugin aktivieren:**
   ```
   WordPress Admin → Plugins → WPMA Agent → Aktivieren
   ```

---

## Nach dem Update

### 1. Permalinks neu speichern
```
WordPress Admin → Einstellungen → Permalinks → Änderungen speichern
```

Dies registriert die neuen REST API Endpoints.

### 2. Verbindung testen
```
WordPress Admin → Einstellungen → WPMA Agent → Verbindung testen
```

Du solltest eine ✅ grüne Erfolgsmeldung sehen.

### 3. Dashboard überprüfen
```
https://app.wpma.io/dashboard
```

Das Dashboard sollte jetzt zeigen:
- ✅ **Plugins:** 24 / 3 (24 aktive, 3 Updates)
- ✅ **Themes:** Anzahl Themes
- ✅ **WordPress:** 6.9.1
- ✅ **PHP:** 8.2.27
- ✅ **Posts/Pages/Comments:** Korrekte Zahlen

### 4. Manuellen Sync auslösen (Optional)
```bash
# Im Dashboard auf "Sync" klicken
# Oder per API:
curl -X POST https://app.wpma.io/api/v1/sync/sites/1/sync \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Testen der REST API

### Direkt von außen testen:

```bash
# Plugins abrufen
curl "https://panoart360.de/wp-json/wpma/v1/plugins" \
  -H "X-WPMA-API-Key: cc5935d5-d20d-4fff-9ea4-d6b3fc6b5d07"

# Themes abrufen
curl "https://panoart360.de/wp-json/wpma/v1/themes" \
  -H "X-WPMA-API-Key: cc5935d5-d20d-4fff-9ea4-d6b3fc6b5d07"

# Stats abrufen
curl "https://panoart360.de/wp-json/wpma/v1/stats" \
  -H "X-WPMA-API-Key: cc5935d5-d20d-4fff-9ea4-d6b3fc6b5d07"
```

Erwartetes Ergebnis:
```json
{
  "success": true,
  "data": [...],
  "total": 24,
  "active": 24,
  "updates": 3
}
```

---

## Troubleshooting

### Problem: 404 Fehler nach Update

**Lösung:** Permalinks neu speichern
```
WordPress Admin → Einstellungen → Permalinks → Änderungen speichern
```

### Problem: "Ungültiger API-Key"

**Lösung:** API-Key neu eintragen
```
WordPress Admin → Einstellungen → WPMA Agent
API-Key: cc5935d5-d20d-4fff-9ea4-d6b3fc6b5d07
```

### Problem: Dashboard zeigt immer noch "0 / 0"

**Lösung:** 
1. Permalinks neu speichern
2. Browser-Cache leeren
3. Manuellen Sync auslösen
4. Seite neu laden (F5)

---

## Changelog

### Version 1.4.0 (2026-02-17)
- ✅ NEU: REST API Endpoints für Plugin-Daten
- ✅ NEU: REST API Endpoints für Theme-Daten
- ✅ NEU: REST API Endpoints für Site-Statistiken
- ✅ NEU: REST API Endpoints für Security-Checks
- ✅ NEU: REST API Endpoints für Performance-Metriken
- ✅ FIX: Dashboard zeigt jetzt korrekte Plugin/Theme-Anzahl
- ✅ FIX: Sync funktioniert jetzt bidirektional

### Version 1.3.0 (vorher)
- Basis-Funktionalität
- Nur Push-Daten an Dashboard

---

## Download

**Plugin-Datei:**
```
/opt/projects/saas-project-1/wpma-agent-1.4.0.zip
```

**Größe:** ~100 KB

---

## Support

Falls Probleme auftreten:

1. **WordPress Error Log prüfen:**
   ```
   /wp-content/debug.log
   ```

2. **WPMA Backend Logs:**
   ```bash
   docker logs wpma-backend
   ```

3. **REST API manuell testen:**
   ```bash
   curl https://panoart360.de/wp-json/wpma/v1/plugins \
     -H "X-WPMA-API-Key: cc5935d5-d20d-4fff-9ea4-d6b3fc6b5d07"
   ```

---

**Nach dem Update wird dein Dashboard endlich alle 24 Plugins korrekt anzeigen!** 🎉
