# Codebase Concerns – Auflösungsplan

> Erstellt: 2026-03-29  
> Basis: Verifizierte Befunde aus Codebase-Analyse

---

## Zusammenfassungstabelle

| # | Befund | Status | Priorität | Aufwand |
|---|--------|--------|-----------|---------|
| 1 | Minimale Testabdeckung | ✅ Bestätigt | Kritisch | Groß |
| 2 | Gemischtes Controller-Muster | ✅ Bestätigt | Hoch | Mittel |
| 3 | Massenhafte .md-Dateien im Root | ✅ Bestätigt | Niedrig | Klein |
| 4 | Duales `getUserId`-Muster | ✅ Bestätigt | Hoch | Klein |
| 5 | `.env.production` im Repo | ❌ Nicht relevant | — | — |
| 6 | Große Migrations-Dateisammlung | ✅ Bestätigt | Mittel | Mittel |
| 7 | LLM-Fallback-Kette | ⚠️ Teilweise | Mittel | Mittel |
| 8 | Frontend API-Client-Typsicherheit | ✅ Bestätigt | Hoch | Mittel |
| 9 | Bull Queue Fehlerbehandlung | ✅ Bestätigt | Hoch | Mittel |
| 10 | Socket.io Authentifizierung | ⚠️ Teilweise | Mittel | Klein |
| 11 | HMAC-Replay-Fenster | ❌ Nicht relevant | — | — |
| 12 | Zip-Dateien im Repo-Root | ✅ Bestätigt | Mittel | Klein |
| 13 | `server-check.sh` ungetrackt | ✅ Bestätigt | Niedrig | Klein |
| 14 | Frontend `read_only` + `tmpfs` | ⚠️ Teilweise | Mittel | Mittel |
| 15 | Keine Frontend E2E-Tests | ✅ Bestätigt | Hoch | Groß |

---

## Priorität: Kritisch

---

### 1 – Minimale Testabdeckung

**Status:** ✅ Bestätigt

**Befund:**  
Nur 3 Test-Dateien für 34 Routen und 35+ Services. Keinerlei Frontend-Tests vorhanden. Das Risiko unentdeckter Regressionen bei Änderungen ist hoch.

**Maßnahmen:**
1. Teststrategie definieren: Unit-Tests für Services, Integrationstests für Routen (Backend).
2. Priorität auf die meistgenutzten und kritischsten Services legen (Auth, Sites, Billing).
3. Test-Framework einrichten/vereinheitlichen (z. B. Jest + Supertest für Backend).
4. Mindest-Coverage-Schwellenwert (z. B. 60 %) in CI erzwingen.
5. Frontend-Komponententests mit React Testing Library einführen (nach Concern 15 koordinieren).

**Aufwand:** Groß  
**Priorität:** Kritisch

---

## Priorität: Hoch

---

### 2 – Gemischtes Controller-Muster

**Status:** ✅ Bestätigt

**Befund:**  
27 von 34 Routen-Dateien enthalten die gesamte Geschäftslogik inline. Nur 7 Dateien delegieren an Controller. Das erschwert Testbarkeit, Wartung und einheitliches Fehlerhandling.

**Maßnahmen:**
1. Controller-Konvention dokumentieren (interne Dev-Notiz, kein README).
2. Schrittweise Extraktion: Pro Sprint 3–4 Route-Dateien in Controller auslagern.
3. Mit den Routes mit der höchsten Komplexität oder Fehlerhäufigkeit beginnen.
4. Sicherstellen, dass extrahierte Controller direkt unit-testbar sind.

**Aufwand:** Mittel  
**Priorität:** Hoch

---

### 4 – Duales `getUserId`-Muster

**Status:** ✅ Bestätigt

**Befund:**  
102 Vorkommen des Musters `req.user?.userId || req.user?.id` im Backend. Das deutet auf eine unvollständige Migration zwischen zwei User-ID-Feldern hin und erhöht das Risiko stiller Auth-Fehler.

**Maßnahmen:**
1. Klären, welches Feld (`userId` oder `id`) der JWT-Payload tatsächlich setzt (Auth-Middleware prüfen).
2. Das veraltete Feld aus dem JWT-Payload entfernen oder einen Middleware-Normalisierer einführen, der `req.user.id` einheitlich setzt.
3. Alle 102 Vorkommen durch das einheitliche Feld ersetzen (skript-assistiert möglich).
4. Regressionstest für Auth-Middleware schreiben.

**Aufwand:** Klein  
**Priorität:** Hoch

---

### 8 – Frontend API-Client-Typsicherheit

**Status:** ✅ Bestätigt

**Befund:**  
`ApiResponse<T = any>` als generischer Standardtyp, die meisten API-Methoden sind nicht explizit getypt. Fehler durch falsche Datenzugriffe werden zur Laufzeit statt zur Kompilierzeit sichtbar.

**Maßnahmen:**
1. Zentrale Typdefinitionen für alle wichtigen API-Antwortstrukturen anlegen (z. B. `types/api.ts`).
2. `any`-Default in `ApiResponse` entfernen; stattdessen `unknown` oder konkrete Typen verwenden.
3. Alle API-Methoden in `lib/api.ts` schrittweise mit Rückgabetypen versehen.
4. TypeScript `strict`-Modus prüfen – sofern noch nicht aktiv, aktivieren.

**Aufwand:** Mittel  
**Priorität:** Hoch

---

### 9 – Bull Queue Fehlerbehandlung

**Status:** ✅ Bestätigt

**Befund:**  
In den Queue-Catch-Blöcken wird ausschließlich `console.error` verwendet. Keine Dead-Letter-Queue (DLQ), keine Retry-Logik, keine strukturierte Alarmierung. Fehlgeschlagene Jobs verschwinden unbemerkt.

**Maßnahmen:**
1. Strukturiertes Logging (z. B. Winston oder Pino) anstelle von `console.error` einsetzen.
2. Bull-eigene `failed`-Event-Handler registrieren, um fehlgeschlagene Jobs zu erfassen.
3. Maximale Retry-Anzahl und Backoff-Strategie pro Queue-Typ konfigurieren.
4. Dashboard oder einfaches Alert-Logging für Jobs einrichten, die alle Retries ausgeschöpft haben (DLQ-Äquivalent).

**Aufwand:** Mittel  
**Priorität:** Hoch

---

### 15 – Keine Frontend E2E-Tests

**Status:** ✅ Bestätigt

**Befund:**  
Weder Playwright noch Cypress noch ein anderes E2E-Framework ist im Frontend vorhanden. Kritische User-Flows (Login, Dashboard, Agent-Interaktion) sind nicht automatisch abgedeckt.

**Maßnahmen:**
1. E2E-Framework auswählen (Empfehlung: Playwright wegen Next.js-Kompatibilität).
2. Playwright in `wpma-frontend` als Dev-Dependency einrichten.
3. Kritische Smoke-Tests zuerst: Login-Flow, Dashboard-Laden, wichtigste CRUD-Operationen.
4. E2E-Tests in CI-Pipeline integrieren (separater Job, darf langsamer sein).

**Aufwand:** Groß  
**Priorität:** Hoch

---

## Priorität: Mittel

---

### 6 – Große Migrations-Dateisammlung

**Status:** ✅ Bestätigt

**Befund:**  
16 SQL-Migrationsdateien mit gemischtem Benennungsschema (nummeriert und ad-hoc). Das erschwert die Nachvollziehbarkeit der Datenbank-Historie und kann zu Migrationsreihenfolge-Fehlern führen.

**Maßnahmen:**
1. Einheitliches Namensschema festlegen (z. B. `YYYYMMDD_HHMMSS_beschreibung.sql` oder sequenziell `0001_...`).
2. Bestehende ad-hoc benannte Dateien umbenennen und in der Changelog-Tabelle anpassen (sofern vorhanden).
3. Migrations-Tool evaluieren, falls noch keines genutzt wird (z. B. `db-migrate`, `Flyway`, oder ORMs wie Prisma/Sequelize).
4. Migrationsstatus in CI prüfen lassen.

**Aufwand:** Mittel  
**Priorität:** Mittel

---

### 7 – LLM-Fallback-Kette

**Status:** ⚠️ Teilweise

**Befund:**  
Eine Fallback-Kette (Groq → Anthropic → OpenRouter) ist implementiert. Fehlerbehandlung erfolgt via einfachem `try/catch`. Es gibt kein Monitoring, welcher Provider tatsächlich verwendet wird, und keine strukturierte Protokollierung von Provider-Ausfällen.

**Maßnahmen:**
1. Strukturiertes Logging pro Provider-Aufruf einführen (welcher Provider, Latenz, Erfolg/Fehler).
2. Metrik-Counter pro Provider (auch simpel: in-memory oder Log-basiert) hinzufügen.
3. Fehlerklassen differenzieren: temporärer Ausfall vs. Konfigurationsfehler vs. Rate-Limit.
4. Optional: Health-Check-Endpunkt, der den aktiven Provider meldet.

**Aufwand:** Mittel  
**Priorität:** Mittel

---

### 10 – Socket.io Authentifizierung

**Status:** ⚠️ Teilweise

**Befund:**  
JWT-Middleware ist vorhanden. Nicht-authentifizierte Verbindungen werden jedoch zugelassen – sie können nur keinen User-Rooms beitreten. Abhängig vom Use-Case kann das unkontrollierte Verbindungslast erzeugen.

**Maßnahmen:**
1. Bewusste Entscheidung treffen und dokumentieren: Sollen unauthentifizierte Verbindungen erlaubt sein (z. B. für öffentliche Status-Broadcasts)?
2. Falls nein: Verbindung ohne gültiges JWT sofort in der `connection`-Phase trennen.
3. Falls ja: Rate-Limiting für nicht-authentifizierte Verbindungen einführen, um Missbrauch zu begrenzen.

**Aufwand:** Klein  
**Priorität:** Mittel

---

### 12 – Zip-Dateien im Repo-Root

**Status:** ✅ Bestätigt

**Befund:**  
Zwei Zip-Dateien liegen im Projekt-Root. Binärdateien im Git-Repository erhöhen die Repo-Größe und sind in der Regel Artefakte, die dort nicht hingehören.

**Maßnahmen:**
1. Zweck der Zip-Dateien klären.
2. Falls Build-Artefakte oder temporäre Dateien: löschen und `*.zip` zu `.gitignore` hinzufügen.
3. Falls notwendige Assets: in einen dedizierten `assets/`- oder `dist/`-Ordner verschieben und bei Bedarf per CI erzeugen.

**Aufwand:** Klein  
**Priorität:** Mittel

---

### 14 – Frontend `read_only` + `tmpfs`

**Status:** ⚠️ Teilweise

**Befund:**  
Die Docker-Konfiguration für `read_only` und `tmpfs` ist vorhanden. Ob Next.js im Produktionsbetrieb in dieser Konfiguration korrekt funktioniert (z. B. Schreibzugriffe auf `.next/cache`, temporäre Dateien), ist nicht verifiziert.

**Maßnahmen:**
1. Staging-Umgebung mit der exakten `read_only`+`tmpfs`-Konfiguration starten.
2. Kritische User-Flows manuell oder per Smoke-Test durchlaufen.
3. Docker-Logs auf Schreib-Fehler (`EROFS`, `read-only file system`) prüfen.
4. Bei Problemen: fehlende beschreibbare Pfade als zusätzliche `tmpfs`-Mounts oder `volumes` eintragen.

**Aufwand:** Mittel  
**Priorität:** Mittel

---

## Priorität: Niedrig

---

### 3 – Massenhafte .md-Dateien im Repo-Root

**Status:** ✅ Bestätigt

**Befund:**  
28 Markdown-Dateien im Projekt-Root. Das verschlechtert die Übersichtlichkeit des Repositories und lässt auf unkontrollierte Dokumentations-Akkumulation schließen.

**Maßnahmen:**
1. Dateien sichten und in thematische Unterordner verschieben (z. B. `.planning/`, `docs/`).
2. Veraltete oder redundante Dateien löschen.
3. `.gitignore` oder Repo-Konvention festlegen, um weiteres Anhäufen zu verhindern.

**Aufwand:** Klein  
**Priorität:** Niedrig

---

### 13 – `server-check.sh` ungetrackt

**Status:** ✅ Bestätigt

**Befund:**  
Die Datei `server-check.sh` existiert im Arbeitsverzeichnis, ist aber nicht in Git getrackt. Je nach Inhalt könnte sie ein nützliches Wartungsskript oder ein vergessener temporärer Fund sein.

**Maßnahmen:**
1. Inhalt prüfen: Ist das Skript produktionsrelevant?
2. Falls ja: zu Git hinzufügen, ggf. in `scripts/`-Ordner verschieben.
3. Falls nein: löschen oder explizit zu `.gitignore` hinzufügen.

**Aufwand:** Klein  
**Priorität:** Niedrig

---

## Nicht relevant

---

### 5 – `.env.production` im Repo

**Status:** ❌ Nicht relevant

**Befund:**  
`.env.production` ist in `.gitignore` eingetragen und die Datei existiert nicht im Repository. Kein Handlungsbedarf.

---

### 11 – HMAC-Replay-Fenster

**Status:** ❌ Nicht relevant

**Befund:**  
Im Backend wurde keine Replay-Fenster-Durchsetzung gefunden. Das Rate-Limit beträgt 15 Minuten. Die Replay-Prüfung liegt auf Agent-Seite. Das ist eine bewusste Architekturentscheidung, kein Backend-Defizit.

---
