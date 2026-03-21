# WPMA Plugin Installation - Anleitung für panoart360.de

## Problem
Das Dashboard zeigt "0 / 0" Plugins, weil das WPMA WordPress-Plugin nicht auf der Site installiert ist.

## Lösung: WPMA Plugin installieren

### Schritt 1: Plugin herunterladen
Das Plugin ist bereits gebaut unter:
- `/opt/projects/saas-project-1/wpma-agent.zip`
- Oder die neueste Version: `wpma-agent-1.3.0.zip`

### Schritt 2: Plugin auf WordPress hochladen

1. **Gehe zu WordPress Admin:**
   ```
   https://panoart360.de/wp-admin/
   ```

2. **Navigiere zu Plugins → Installieren:**
   - Klicke auf "Plugin hochladen"
   - Wähle die Datei `wpma-agent-1.3.0.zip`
   - Klicke auf "Jetzt installieren"

3. **Plugin aktivieren:**
   - Klicke auf "Plugin aktivieren"

### Schritt 3: API-Key konfigurieren

1. **Gehe zu WPMA Einstellungen:**
   ```
   WordPress Admin → Einstellungen → WPMA Agent
   ```

2. **API-Key aus Dashboard kopieren:**
   ```
   Dein API-Key: cc5935d5-d20d-4fff-9ea4-d6b3fc6b5d07
   ```

3. **API-Key eintragen:**
   - Trage den API-Key in das Eingabefeld ein
   - Klicke auf "Einstellungen speichern"

4. **Verbindung testen:**
   - Klicke auf "Verbindung testen"
   - Du solltest eine grüne Erfolgsmeldung sehen

### Schritt 4: Erste Synchronisation

Nach erfolgreicher Verbindung:
- Das Plugin sendet automatisch alle Daten an das Dashboard
- Plugins (alle 15!)
- Themes
- WordPress Core Version
- Site-Statistiken
- Security-Status

### Alternative: FTP-Upload

Falls du keinen Zugriff auf WordPress Admin hast:

1. **Per FTP verbinden:**
   ```
   Host: panoart360.de
   Ordner: /wp-content/plugins/
   ```

2. **Plugin hochladen:**
   - Entpacke `wpma-agent-1.3.0.zip` lokal
   - Lade den Ordner `wpma-agent/` per FTP hoch nach:
     ```
     /wp-content/plugins/wpma-agent/
     ```

3. **Plugin aktivieren:**
   - Gehe zu WordPress Admin → Plugins
   - Suche "WPMA Agent"
   - Klicke auf "Aktivieren"

### Was das Plugin macht

Das WPMA Plugin registriert folgende REST API Endpoints:

```
https://panoart360.de/wp-json/wpma/v1/plugins
https://panoart360.de/wp-json/wpma/v1/themes
https://panoart360.de/wp-json/wpma/v1/core-update
https://panoart360.de/wp-json/wpma/v1/stats
https://panoart360.de/wp-json/wpma/v1/security-check
https://panoart360.de/wp-json/wpma/v1/performance
https://panoart360.de/wp-json/wpma/v1/backup
```

Diese Endpoints liefern alle Daten an das Dashboard.

### Nach Installation

Das Dashboard sollte dann zeigen:
- ✅ **Plugins:** 15 / 0 (15 aktive, 0 Updates)
- ✅ **Themes:** Deine installierten Themes
- ✅ **WordPress Version:** z.B. 6.7
- ✅ **PHP Version:** Deine Server-PHP-Version
- ✅ **Site-Statistiken:** Posts, Pages, Comments
- ✅ **Letzter Sync:** Aktueller Timestamp

### Debugging

Falls es nicht funktioniert:

1. **Permalinks neu speichern:**
   ```
   WordPress Admin → Einstellungen → Permalinks → Änderungen speichern
   ```

2. **REST API testen:**
   ```bash
   curl https://panoart360.de/wp-json/wpma/v1/plugins
   ```
   
3. **Error Log prüfen:**
   ```
   WordPress Admin → Tools → Site Health → Info → WordPress
   ```

---

**Dein API-Key:**
```
cc5935d5-d20d-4fff-9ea4-d6b3fc6b5d07
```

**Dein Setup-Token (Alternative):**
```
Setup-Token wird im Dashboard unter Site-Details angezeigt
```

---

**Nach erfolgreicher Installation kannst du:**
- Alle 15 Plugins im Dashboard sehen und verwalten
- Updates zentral durchführen
- Backups erstellen
- Security-Scans durchführen
- Performance-Metriken sehen
- Staging-Umgebungen erstellen
