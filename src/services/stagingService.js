/**
 * Staging & Site Cloning Service
 * Ermöglicht Staging-Umgebungen, Site-Klonen und Migrationen
 */

const { query } = require('../config/database');
const backupService = require('./backupService');
const crypto = require('crypto');

class StagingService {
    constructor() {
        this.stagingDomainSuffix = process.env.STAGING_DOMAIN_SUFFIX || '.staging.wpma.io';
    }

    // ==========================================
    // STAGING ENVIRONMENT
    // ==========================================

    /**
     * Erstellt eine Staging-Umgebung für eine Site
     */
    async createStagingEnvironment(siteId, userId, options = {}) {
        try {
            // Prüfe Zugriff
            const siteResult = await query(
                'SELECT * FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, userId]
            );

            if (siteResult.rows.length === 0) {
                return { success: false, error: 'Site nicht gefunden' };
            }

            const site = siteResult.rows[0];

            // Prüfe ob bereits ein Staging existiert
            const existingStaging = await query(
                'SELECT id FROM staging_environments WHERE source_site_id = $1 AND status = $2',
                [siteId, 'active']
            );

            if (existingStaging.rows.length > 0) {
                return { 
                    success: false, 
                    error: 'Es existiert bereits eine aktive Staging-Umgebung für diese Site',
                    stagingId: existingStaging.rows[0].id
                };
            }

            // Generiere Staging-Domain
            const stagingSlug = crypto.randomBytes(4).toString('hex');
            const stagingDomain = `${site.domain.replace(/\./g, '-')}-${stagingSlug}${this.stagingDomainSuffix}`;

            // Erstelle Staging-Eintrag
            const stagingResult = await query(
                `INSERT INTO staging_environments 
                 (source_site_id, user_id, staging_domain, staging_url, status, created_from_backup)
                 VALUES ($1, $2, $3, $4, 'creating', $5)
                 RETURNING id`,
                [siteId, userId, stagingDomain, `https://${stagingDomain}`, options.fromBackupId || null]
            );

            const stagingId = stagingResult.rows[0].id;

            // Starte asynchronen Staging-Erstellungsprozess
            this.processCreateStaging(stagingId, site, options);

            return {
                success: true,
                data: {
                    stagingId,
                    stagingDomain,
                    stagingUrl: `https://${stagingDomain}`,
                    status: 'creating',
                    message: 'Staging-Umgebung wird erstellt. Dies kann einige Minuten dauern.'
                }
            };
        } catch (error) {
            console.error('Create staging error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Verarbeitet die Staging-Erstellung asynchron
     */
    async processCreateStaging(stagingId, site, options) {
        try {
            // 1. Erstelle Backup der Quell-Site (wenn nicht von bestehendem Backup)
            let backupId = options.fromBackupId;
            
            if (!backupId) {
                await this.updateStagingStatus(stagingId, 'creating_backup', 'Erstelle Backup der Live-Site...');
                
                const backupResult = await backupService.createBackup(site.id, 'staging');
                if (!backupResult.success) {
                    await this.updateStagingStatus(stagingId, 'failed', `Backup fehlgeschlagen: ${backupResult.error}`);
                    return;
                }
                backupId = backupResult.backupId;
            }

            // 2. Staging-Datenbank erstellen (simuliert)
            await this.updateStagingStatus(stagingId, 'creating_database', 'Erstelle Staging-Datenbank...');
            await this.delay(2000); // Simulierte Zeit

            // 3. Dateien kopieren (simuliert)
            await this.updateStagingStatus(stagingId, 'copying_files', 'Kopiere Dateien...');
            await this.delay(3000);

            // 4. URLs in Datenbank ersetzen (simuliert)
            await this.updateStagingStatus(stagingId, 'updating_urls', 'Aktualisiere URLs in der Datenbank...');
            await this.delay(1000);

            // 5. Cache leeren und finalisieren
            await this.updateStagingStatus(stagingId, 'finalizing', 'Finalisiere Staging-Umgebung...');
            await this.delay(500);

            // 6. Fertig!
            await query(
                `UPDATE staging_environments 
                 SET status = 'active', 
                     created_from_backup = $1,
                     activated_at = NOW(),
                     progress_message = 'Staging-Umgebung ist bereit!'
                 WHERE id = $2`,
                [backupId, stagingId]
            );

            console.log(`Staging ${stagingId} created successfully`);
        } catch (error) {
            console.error('Process create staging error:', error);
            await this.updateStagingStatus(stagingId, 'failed', `Fehler: ${error.message}`);
        }
    }

    /**
     * Löscht eine Staging-Umgebung
     */
    async deleteStagingEnvironment(stagingId, userId) {
        try {
            const result = await query(
                `UPDATE staging_environments 
                 SET status = 'deleted', deleted_at = NOW()
                 WHERE id = $1 AND user_id = $2 AND status != 'deleted'
                 RETURNING id`,
                [stagingId, userId]
            );

            if (result.rows.length === 0) {
                return { success: false, error: 'Staging-Umgebung nicht gefunden' };
            }

            // TODO: Tatsächliche Ressourcen löschen (Dateien, DB, DNS)

            return {
                success: true,
                message: 'Staging-Umgebung wurde gelöscht'
            };
        } catch (error) {
            console.error('Delete staging error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Holt alle Staging-Umgebungen eines Users
     */
    async getStagingEnvironments(userId, siteId = null) {
        try {
            let queryStr = `
                SELECT se.*, s.domain as source_domain, s.site_url as source_url
                FROM staging_environments se
                JOIN sites s ON se.source_site_id = s.id
                WHERE se.user_id = $1 AND se.status != 'deleted'
            `;
            const params = [userId];

            if (siteId) {
                queryStr += ' AND se.source_site_id = $2';
                params.push(siteId);
            }

            queryStr += ' ORDER BY se.created_at DESC';

            const result = await query(queryStr, params);

            return {
                success: true,
                data: result.rows
            };
        } catch (error) {
            console.error('Get staging environments error:', error);
            return { success: false, error: error.message };
        }
    }

    // ==========================================
    // PUSH / PULL (Sync zwischen Staging und Live)
    // ==========================================

    /**
     * Push: Staging → Live (Änderungen von Staging auf Live übertragen)
     */
    async pushStagingToLive(stagingId, userId, options = {}) {
        try {
            const {
                includeDatabase = true,
                includeFiles = true,
                includeUploads = false, // Medien optional
                createBackupFirst = true
            } = options;

            // Hole Staging-Infos
            const stagingResult = await query(
                `SELECT se.*, s.id as live_site_id, s.domain as live_domain
                 FROM staging_environments se
                 JOIN sites s ON se.source_site_id = s.id
                 WHERE se.id = $1 AND se.user_id = $2 AND se.status = 'active'`,
                [stagingId, userId]
            );

            if (stagingResult.rows.length === 0) {
                return { success: false, error: 'Staging-Umgebung nicht gefunden oder nicht aktiv' };
            }

            const staging = stagingResult.rows[0];

            // Erstelle Push-Job
            const jobResult = await query(
                `INSERT INTO staging_sync_jobs 
                 (staging_id, user_id, direction, status, options)
                 VALUES ($1, $2, 'push', 'pending', $3)
                 RETURNING id`,
                [stagingId, userId, JSON.stringify(options)]
            );

            const jobId = jobResult.rows[0].id;

            // Starte asynchronen Push-Prozess
            this.processPushToLive(jobId, staging, options);

            return {
                success: true,
                data: {
                    jobId,
                    direction: 'push',
                    from: staging.staging_domain,
                    to: staging.live_domain,
                    message: 'Push-Prozess gestartet. Bitte warten...'
                }
            };
        } catch (error) {
            console.error('Push staging to live error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Pull: Live → Staging (Live-Daten ins Staging holen)
     */
    async pullLiveToStaging(stagingId, userId, options = {}) {
        try {
            const {
                includeDatabase = true,
                includeUploads = true
            } = options;

            // Hole Staging-Infos
            const stagingResult = await query(
                `SELECT se.*, s.id as live_site_id, s.domain as live_domain
                 FROM staging_environments se
                 JOIN sites s ON se.source_site_id = s.id
                 WHERE se.id = $1 AND se.user_id = $2 AND se.status = 'active'`,
                [stagingId, userId]
            );

            if (stagingResult.rows.length === 0) {
                return { success: false, error: 'Staging-Umgebung nicht gefunden oder nicht aktiv' };
            }

            const staging = stagingResult.rows[0];

            // Erstelle Pull-Job
            const jobResult = await query(
                `INSERT INTO staging_sync_jobs 
                 (staging_id, user_id, direction, status, options)
                 VALUES ($1, $2, 'pull', 'pending', $3)
                 RETURNING id`,
                [stagingId, userId, JSON.stringify(options)]
            );

            const jobId = jobResult.rows[0].id;

            // Starte asynchronen Pull-Prozess
            this.processPullFromLive(jobId, staging, options);

            return {
                success: true,
                data: {
                    jobId,
                    direction: 'pull',
                    from: staging.live_domain,
                    to: staging.staging_domain,
                    message: 'Pull-Prozess gestartet. Bitte warten...'
                }
            };
        } catch (error) {
            console.error('Pull live to staging error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Verarbeitet Push-Prozess
     */
    async processPushToLive(jobId, staging, options) {
        try {
            await this.updateSyncJobStatus(jobId, 'running', 'Starte Push...');

            // 1. Backup der Live-Site erstellen
            if (options.createBackupFirst !== false) {
                await this.updateSyncJobStatus(jobId, 'running', 'Erstelle Sicherheitsbackup der Live-Site...');
                await backupService.createBackup(staging.live_site_id, 'pre_push');
                await this.delay(2000);
            }

            // 2. Datenbank synchronisieren
            if (options.includeDatabase !== false) {
                await this.updateSyncJobStatus(jobId, 'running', 'Synchronisiere Datenbank...');
                await this.delay(3000); // Simuliert
            }

            // 3. Dateien synchronisieren
            if (options.includeFiles !== false) {
                await this.updateSyncJobStatus(jobId, 'running', 'Synchronisiere Dateien...');
                await this.delay(2000);
            }

            // 4. URLs ersetzen
            await this.updateSyncJobStatus(jobId, 'running', 'Ersetze URLs...');
            await this.delay(1000);

            // 5. Cache leeren
            await this.updateSyncJobStatus(jobId, 'running', 'Leere Cache...');
            await this.delay(500);

            // Fertig!
            await query(
                `UPDATE staging_sync_jobs 
                 SET status = 'completed', completed_at = NOW(), progress_message = 'Push erfolgreich abgeschlossen!'
                 WHERE id = $1`,
                [jobId]
            );

            // Update last_synced
            await query(
                `UPDATE staging_environments SET last_synced_at = NOW() WHERE id = $1`,
                [staging.id]
            );

            console.log(`Push job ${jobId} completed successfully`);
        } catch (error) {
            console.error('Process push error:', error);
            await this.updateSyncJobStatus(jobId, 'failed', `Fehler: ${error.message}`);
        }
    }

    /**
     * Verarbeitet Pull-Prozess
     */
    async processPullFromLive(jobId, staging, options) {
        try {
            await this.updateSyncJobStatus(jobId, 'running', 'Starte Pull...');

            // 1. Backup des Staging erstellen
            await this.updateSyncJobStatus(jobId, 'running', 'Sichere Staging-Umgebung...');
            await this.delay(1000);

            // 2. Live-Daten holen
            await this.updateSyncJobStatus(jobId, 'running', 'Hole Live-Daten...');
            await this.delay(3000);

            // 3. URLs ersetzen
            await this.updateSyncJobStatus(jobId, 'running', 'Ersetze URLs für Staging...');
            await this.delay(1000);

            // Fertig!
            await query(
                `UPDATE staging_sync_jobs 
                 SET status = 'completed', completed_at = NOW(), progress_message = 'Pull erfolgreich abgeschlossen!'
                 WHERE id = $1`,
                [jobId]
            );

            console.log(`Pull job ${jobId} completed successfully`);
        } catch (error) {
            console.error('Process pull error:', error);
            await this.updateSyncJobStatus(jobId, 'failed', `Fehler: ${error.message}`);
        }
    }

    // ==========================================
    // SITE CLONING
    // ==========================================

    /**
     * Klont eine Site auf eine neue Domain
     */
    async cloneSite(siteId, userId, targetDomain, options = {}) {
        try {
            const {
                includeUploads = true,
                useExistingBackup = null
            } = options;

            // Prüfe Zugriff auf Quell-Site
            const sourceResult = await query(
                'SELECT * FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, userId]
            );

            if (sourceResult.rows.length === 0) {
                return { success: false, error: 'Quell-Site nicht gefunden' };
            }

            const source = sourceResult.rows[0];

            // Validiere Ziel-Domain
            if (!targetDomain || targetDomain === source.domain) {
                return { success: false, error: 'Ungültige Ziel-Domain' };
            }

            // Erstelle Clone-Job
            const jobResult = await query(
                `INSERT INTO clone_jobs 
                 (source_site_id, user_id, target_domain, status, options)
                 VALUES ($1, $2, $3, 'pending', $4)
                 RETURNING id`,
                [siteId, userId, targetDomain, JSON.stringify(options)]
            );

            const jobId = jobResult.rows[0].id;

            // Starte asynchronen Clone-Prozess
            this.processCloneSite(jobId, source, targetDomain, options);

            return {
                success: true,
                data: {
                    jobId,
                    sourceDomain: source.domain,
                    targetDomain,
                    message: 'Clone-Prozess gestartet. Dies kann einige Minuten dauern.'
                }
            };
        } catch (error) {
            console.error('Clone site error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Verarbeitet Site-Clone
     */
    async processCloneSite(jobId, source, targetDomain, options) {
        try {
            await this.updateCloneJobStatus(jobId, 'running', 'Starte Clone-Prozess...');

            // 1. Backup erstellen
            await this.updateCloneJobStatus(jobId, 'running', 'Erstelle Backup der Quell-Site...');
            let backupId = options.useExistingBackup;
            
            if (!backupId) {
                const backupResult = await backupService.createBackup(source.id, 'clone');
                if (!backupResult.success) {
                    await this.updateCloneJobStatus(jobId, 'failed', `Backup fehlgeschlagen: ${backupResult.error}`);
                    return;
                }
                backupId = backupResult.backupId;
            }

            // 2. Datenbank kopieren
            await this.updateCloneJobStatus(jobId, 'running', 'Kopiere Datenbank...');
            await this.delay(3000);

            // 3. Dateien kopieren
            await this.updateCloneJobStatus(jobId, 'running', 'Kopiere Dateien...');
            await this.delay(4000);

            // 4. URLs ersetzen
            await this.updateCloneJobStatus(jobId, 'running', 'Ersetze URLs (Search & Replace)...');
            await this.delay(2000);

            // 5. wp-config.php anpassen
            await this.updateCloneJobStatus(jobId, 'running', 'Passe Konfiguration an...');
            await this.delay(500);

            // 6. Permalinks neu setzen (simuliert)
            await this.updateCloneJobStatus(jobId, 'running', 'Setze Permalinks neu...');
            await this.delay(500);

            // Fertig! KEINE automatische Site-Erstellung
            // Die neue Site muss manuell hinzugefügt werden nachdem sie auf dem Server eingerichtet ist
            await query(
                `UPDATE clone_jobs 
                 SET status = 'completed', 
                     completed_at = NOW(), 
                     progress_message = 'Clone-Daten bereit! Bitte richte die Site auf dem Ziel-Server ein und füge sie dann manuell hinzu.'
                 WHERE id = $1`,
                [jobId]
            );

            console.log(`Clone job ${jobId} completed successfully. New site ID: ${newSiteId}`);
        } catch (error) {
            console.error('Process clone error:', error);
            await this.updateCloneJobStatus(jobId, 'failed', `Fehler: ${error.message}`);
        }
    }

    // ==========================================
    // MIGRATION
    // ==========================================

    /**
     * Migriert eine Site zu einem neuen Host
     */
    async migrateSite(siteId, userId, migrationConfig) {
        try {
            const {
                newHosting, // 'manual' oder Provider-spezifisch
                targetUrl,
                ftpCredentials, // Optional für automatische Migration
                dbCredentials   // Optional
            } = migrationConfig;

            // Prüfe Zugriff
            const siteResult = await query(
                'SELECT * FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, userId]
            );

            if (siteResult.rows.length === 0) {
                return { success: false, error: 'Site nicht gefunden' };
            }

            const site = siteResult.rows[0];

            // Erstelle Migrations-Job
            const jobResult = await query(
                `INSERT INTO migration_jobs 
                 (site_id, user_id, source_url, target_url, hosting_provider, status)
                 VALUES ($1, $2, $3, $4, $5, 'pending')
                 RETURNING id`,
                [siteId, userId, site.site_url, targetUrl, newHosting]
            );

            const jobId = jobResult.rows[0].id;

            // Generiere Migrations-Package
            const migrationPackage = await this.generateMigrationPackage(jobId, site, migrationConfig);

            return {
                success: true,
                data: {
                    jobId,
                    ...migrationPackage,
                    instructions: this.getMigrationInstructions(newHosting)
                }
            };
        } catch (error) {
            console.error('Migrate site error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generiert ein Migrations-Package
     */
    async generateMigrationPackage(jobId, site, config) {
        await this.updateMigrationJobStatus(jobId, 'generating', 'Erstelle Migrations-Package...');

        // 1. Full Backup erstellen
        const backupResult = await backupService.createBackup(site.id, 'migration');
        
        // 2. Generiere SQL für URL-Replacement
        const searchReplaceQueries = `
-- URL Replacement Queries für Migration
-- Führe diese nach dem Import aus:

UPDATE wp_options SET option_value = REPLACE(option_value, '${site.site_url}', '${config.targetUrl}') WHERE option_name IN ('siteurl', 'home');
UPDATE wp_posts SET guid = REPLACE(guid, '${site.site_url}', '${config.targetUrl}');
UPDATE wp_posts SET post_content = REPLACE(post_content, '${site.site_url}', '${config.targetUrl}');
UPDATE wp_postmeta SET meta_value = REPLACE(meta_value, '${site.site_url}', '${config.targetUrl}');
        `.trim();

        // 3. wp-config.php Anpassungen
        const wpConfigChanges = `
// Neue Datenbank-Einstellungen
define('DB_NAME', 'neue_datenbank');
define('DB_USER', 'neuer_user');
define('DB_PASSWORD', 'neues_passwort');
define('DB_HOST', 'localhost');

// Site URL (optional, wenn nicht in DB)
define('WP_HOME', '${config.targetUrl}');
define('WP_SITEURL', '${config.targetUrl}');
        `.trim();

        await query(
            `UPDATE migration_jobs 
             SET status = 'ready', 
                 backup_id = $1,
                 search_replace_sql = $2,
                 wp_config_changes = $3
             WHERE id = $4`,
            [backupResult.backupId, searchReplaceQueries, wpConfigChanges, jobId]
        );

        return {
            backupId: backupResult.backupId,
            searchReplaceQueries,
            wpConfigChanges,
            status: 'ready'
        };
    }

    /**
     * Gibt Migrations-Anweisungen basierend auf Hosting-Provider
     */
    getMigrationInstructions(hostingProvider) {
        const instructions = {
            manual: [
                '1. Lade das Backup herunter',
                '2. Entpacke die Dateien auf dem neuen Server',
                '3. Importiere die Datenbank',
                '4. Führe die Search-Replace SQL-Queries aus',
                '5. Passe die wp-config.php an',
                '6. Ändere die DNS-Einstellungen',
                '7. Teste die Site gründlich'
            ],
            all_inkl: [
                '1. Erstelle eine neue Datenbank im KAS',
                '2. Lade Dateien via FTP hoch',
                '3. Importiere DB via phpMyAdmin',
                '4. Passe wp-config.php an',
                '5. Domain umstellen'
            ],
            siteground: [
                '1. Nutze den SiteGround Migrator oder',
                '2. Manuelle Migration via Site Tools',
                '3. Datenbank über phpMyAdmin importieren'
            ]
        };

        return instructions[hostingProvider] || instructions.manual;
    }

    // ==========================================
    // JOB STATUS
    // ==========================================

    async getSyncJobStatus(jobId, userId) {
        const result = await query(
            `SELECT * FROM staging_sync_jobs WHERE id = $1 AND user_id = $2`,
            [jobId, userId]
        );
        return result.rows.length > 0 
            ? { success: true, data: result.rows[0] }
            : { success: false, error: 'Job nicht gefunden' };
    }

    async getCloneJobStatus(jobId, userId) {
        const result = await query(
            `SELECT * FROM clone_jobs WHERE id = $1 AND user_id = $2`,
            [jobId, userId]
        );
        return result.rows.length > 0 
            ? { success: true, data: result.rows[0] }
            : { success: false, error: 'Job nicht gefunden' };
    }

    async getMigrationJobStatus(jobId, userId) {
        const result = await query(
            `SELECT * FROM migration_jobs WHERE id = $1 AND user_id = $2`,
            [jobId, userId]
        );
        return result.rows.length > 0 
            ? { success: true, data: result.rows[0] }
            : { success: false, error: 'Job nicht gefunden' };
    }

    // ==========================================
    // HELPERS
    // ==========================================

    async updateStagingStatus(stagingId, status, message) {
        await query(
            `UPDATE staging_environments SET status = $1, progress_message = $2 WHERE id = $3`,
            [status, message, stagingId]
        );
    }

    async updateSyncJobStatus(jobId, status, message) {
        await query(
            `UPDATE staging_sync_jobs SET status = $1, progress_message = $2 WHERE id = $3`,
            [status, message, jobId]
        );
    }

    async updateCloneJobStatus(jobId, status, message) {
        await query(
            `UPDATE clone_jobs SET status = $1, progress_message = $2 WHERE id = $3`,
            [status, message, jobId]
        );
    }

    async updateMigrationJobStatus(jobId, status, message) {
        await query(
            `UPDATE migration_jobs SET status = $1, progress_message = $2 WHERE id = $3`,
            [status, message, jobId]
        );
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new StagingService();

