# Schema Migrations

## Alle Migrationen (geordnet)

| # | Dateiname | Beschreibung |
|---|-----------|--------------|
| 001 | `001_initial_schema.sql` | Erstellt Basistabellen: `users`, `sites` |
| 002 | `002_missing_tables.sql` | ALTER auf `users` und `sites` (health_score, last_check, wordpress_version, php_version, security_score, performance_score, uptime_percentage, last_backup, etc.) |
| 003 | `003_content_hub.sql` | Erstellt `content_projects`, Content Publishing Hub (Typen: wordpress, static_html, webflow, custom) |
| 004 | `004_agent_revenue.sql` | Erstellt `agent_tasks`, WooCommerce Revenue Intelligence-Tabellen; autonomer KI-Agent |
| 005 | `005_missing_core_tables.sql` | Erstellt `backups` und weitere fehlende Kerntabellen |
| 006 | `006_onboarding.sql` | ALTER auf `sites` (onboarding_status); erstellt `site_onboarding_steps`, Telegram-Integration |
| 007 | `007_ssl_certs.sql` | Erstellt `ssl_certs` (SSL-Zertifikat-Monitoring pro Site) |
| 008 | `008_backup_schedule_quota.sql` | Erstellt `backup_schedules`, Storage-Quota-Tabellen |
| 009 | `009_sync_tables.sql` | ALTER auf `sites` (last_sync_at, core_update_available, ssl_enabled, security_issues); erstellt `site_plugins`, `site_themes` |
| 010 | `010_setup_token_to_sites.sql` | ALTER auf `sites` (setup_token, setup_token_expires_at, setup_token_used, last_plugin_connection, plugin_version) |
| 011 | `011_screenshot_columns.sql` | ALTER auf `sites` (screenshot, screenshot_updated_at) |
| 012 | `012_plugin_theme_tables.sql` | Erstellt `plugins`, `themes` (detailliertes Plugin-/Theme-Tracking mit Update-Status) |
| 013 | `013_vulnerability_alerts.sql` | Erstellt `vulnerability_alerts` (CVE-Scanning, KI-Relevanzanalyse, Severity-Tracking) |
| 014 | `014_missing_tables.sql` | Erstellt `chat_conversations`, `chat_messages`, Uptime-Monitoring-Tabellen |
| 015 | `015_selfhealing_staging_rollback.sql` | Erstellt `selfhealing_fixes`, `staging_environments`, Rollback-Tabellen |
| 016 | `016_maintenance_reports.sql` | Erstellt `maintenance_reports`, `report_schedules` (PDF-Berichte, Scheduling) |

## Namenskonvention

Alle Migrationsdateien folgen dem Muster `NNN_beschreibung.sql`:

- `NNN` ist eine dreistellige, nullgefüllte Ganzzahl (001, 002, ..., 016), die die Ausführungsreihenfolge festlegt.
- `beschreibung` ist ein kurzer, mit Unterstrichen getrennter Name, der den Inhalt der Migration beschreibt.
- Dateien werden in numerischer Reihenfolge ausgeführt; eine neue Migration erhält immer die nächste freie Nummer.

Beispiel: `009_sync_tables.sql`, `010_setup_token_to_sites.sql`

## Haupttabellen (aus Migrationen abgeleitet)

| Tabelle | Migration | Beschreibung |
|---------|-----------|--------------|
| `users` | 001 | Benutzerkonten, Stripe-Billing, Auth |
| `sites` | 001 | WordPress-Sites (durch viele Migrationen erweitert) |
| `content_projects` | 003 | Content-Publishing-Projekte (multi-target) |
| `agent_tasks` | 004 | Aufgaben des autonomen KI-Agenten |
| `backups` | 005 | Backup-Einträge pro Site |
| `site_onboarding_steps` | 006 | Onboarding-Schrittprotokoll pro Site |
| `ssl_certs` | 007 | SSL-Zertifikatsstatus pro Site |
| `backup_schedules` | 008 | Automatische Backup-Zeitpläne |
| `site_plugins` | 009 | Gecachte Plugin-Daten pro Site (Sync) |
| `site_themes` | 009 | Gecachte Theme-Daten pro Site (Sync) |
| `plugins` | 012 | Detailliertes Plugin-Tracking mit Metadaten |
| `themes` | 012 | Detailliertes Theme-Tracking mit Metadaten |
| `vulnerability_alerts` | 013 | Sicherheitslücken-Scanning mit KI-Analyse |
| `chat_conversations` | 014 | KI-Chat-Konversationen |
| `chat_messages` | 014 | Nachrichten innerhalb von Konversationen |
| `selfhealing_fixes` | 015 | Self-Healing-Aktionen und Status |
| `staging_environments` | 015 | Staging-Umgebungen pro Site |
| `maintenance_reports` | 016 | Generierte Wartungsberichte (PDF etc.) |
| `report_schedules` | 016 | Geplante Report-Zustellung |
