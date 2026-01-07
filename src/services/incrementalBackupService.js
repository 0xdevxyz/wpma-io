/**
 * Incremental Backup Service
 * Ermöglicht inkrementelle und Real-Time Backups
 */

const { query } = require('../config/database');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class IncrementalBackupService {
    constructor() {
        this.checksumCache = new Map();
        this.maxDeltaAge = 30; // Tage bis Full-Backup erzwungen wird
    }

    /**
     * Erstellt ein inkrementelles Backup (nur geänderte Dateien)
     */
    async createIncrementalBackup(siteId, userId) {
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

            // Hole letztes Full-Backup
            const lastFullBackup = await this.getLastFullBackup(siteId);
            
            // Prüfe ob Full-Backup nötig ist
            if (!lastFullBackup || this.needsFullBackup(lastFullBackup)) {
                return await this.createFullBackup(siteId, site);
            }

            // Hole letztes Backup (Full oder Incremental)
            const lastBackup = await this.getLastBackup(siteId);
            
            // Hole aktuelle Datei-Checksums von der Site
            const currentChecksums = await this.getCurrentFileChecksums(site);
            
            // Hole vorherige Checksums
            const previousChecksums = await this.getStoredChecksums(lastBackup.id);
            
            // Finde geänderte Dateien
            const changes = this.findChangedFiles(previousChecksums, currentChecksums);

            if (changes.added.length === 0 && changes.modified.length === 0 && changes.deleted.length === 0) {
                return {
                    success: true,
                    data: {
                        type: 'incremental',
                        changes: 0,
                        message: 'Keine Änderungen seit dem letzten Backup'
                    }
                };
            }

            // Erstelle Backup-Eintrag
            const backupResult = await query(
                `INSERT INTO incremental_backups 
                 (site_id, parent_backup_id, backup_type, status, changes_count)
                 VALUES ($1, $2, 'incremental', 'creating', $3)
                 RETURNING id`,
                [siteId, lastBackup.id, changes.added.length + changes.modified.length + changes.deleted.length]
            );

            const backupId = backupResult.rows[0].id;

            // Starte asynchrone Backup-Erstellung
            this.processIncrementalBackup(backupId, site, changes, currentChecksums);

            return {
                success: true,
                data: {
                    backupId,
                    type: 'incremental',
                    parentBackupId: lastBackup.id,
                    changes: {
                        added: changes.added.length,
                        modified: changes.modified.length,
                        deleted: changes.deleted.length
                    },
                    status: 'creating',
                    message: 'Inkrementelles Backup wird erstellt...'
                }
            };
        } catch (error) {
            console.error('Create incremental backup error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Erstellt ein Full-Backup als Basis für inkrementelle Backups
     */
    async createFullBackup(siteId, site) {
        try {
            // Hole aktuelle Checksums
            const currentChecksums = await this.getCurrentFileChecksums(site);

            // Erstelle Full-Backup Eintrag
            const backupResult = await query(
                `INSERT INTO incremental_backups 
                 (site_id, parent_backup_id, backup_type, status, changes_count)
                 VALUES ($1, NULL, 'full', 'creating', $2)
                 RETURNING id`,
                [siteId, Object.keys(currentChecksums).length]
            );

            const backupId = backupResult.rows[0].id;

            // Starte asynchrone Backup-Erstellung
            this.processFullBackup(backupId, site, currentChecksums);

            return {
                success: true,
                data: {
                    backupId,
                    type: 'full',
                    filesCount: Object.keys(currentChecksums).length,
                    status: 'creating',
                    message: 'Full-Backup wird erstellt...'
                }
            };
        } catch (error) {
            console.error('Create full backup error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Verarbeitet inkrementelles Backup
     */
    async processIncrementalBackup(backupId, site, changes, checksums) {
        try {
            await this.updateBackupStatus(backupId, 'processing', 'Sammle geänderte Dateien...');

            // Simuliere das Sammeln der geänderten Dateien
            await this.delay(1000);

            await this.updateBackupStatus(backupId, 'uploading', 'Lade Änderungen hoch...');

            // Simuliere Upload
            const fileSize = (changes.added.length + changes.modified.length) * 1024; // Geschätzte Größe
            await this.delay(2000);

            // Speichere Checksums
            await this.storeChecksums(backupId, checksums);

            // Speichere Änderungen
            await query(
                `UPDATE incremental_backups 
                 SET status = 'completed', 
                     file_size = $1,
                     completed_at = NOW(),
                     changes_data = $2
                 WHERE id = $3`,
                [fileSize, JSON.stringify(changes), backupId]
            );

            console.log(`Incremental backup ${backupId} completed`);
        } catch (error) {
            console.error('Process incremental backup error:', error);
            await this.updateBackupStatus(backupId, 'failed', `Fehler: ${error.message}`);
        }
    }

    /**
     * Verarbeitet Full-Backup
     */
    async processFullBackup(backupId, site, checksums) {
        try {
            await this.updateBackupStatus(backupId, 'processing', 'Sammle alle Dateien...');
            await this.delay(2000);

            await this.updateBackupStatus(backupId, 'uploading', 'Lade Backup hoch...');
            
            // Simuliere Upload
            const fileCount = Object.keys(checksums).length;
            const fileSize = fileCount * 2048; // Geschätzte Größe
            await this.delay(3000);

            // Speichere Checksums
            await this.storeChecksums(backupId, checksums);

            await query(
                `UPDATE incremental_backups 
                 SET status = 'completed', 
                     file_size = $1,
                     completed_at = NOW()
                 WHERE id = $2`,
                [fileSize, backupId]
            );

            console.log(`Full backup ${backupId} completed`);
        } catch (error) {
            console.error('Process full backup error:', error);
            await this.updateBackupStatus(backupId, 'failed', `Fehler: ${error.message}`);
        }
    }

    /**
     * Aktiviert Real-Time Backup für eine Site
     */
    async enableRealTimeBackup(siteId, userId, options = {}) {
        try {
            const {
                watchInterval = 300, // Sekunden (5 Minuten)
                excludePatterns = ['wp-content/cache/*', 'wp-content/uploads/cache/*'],
                maxDailyBackups = 48
            } = options;

            // Prüfe Zugriff
            const siteResult = await query(
                'SELECT id FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, userId]
            );

            if (siteResult.rows.length === 0) {
                return { success: false, error: 'Site nicht gefunden' };
            }

            // Speichere/Update Real-Time Config
            await query(
                `INSERT INTO realtime_backup_config 
                 (site_id, user_id, is_enabled, watch_interval, exclude_patterns, max_daily_backups)
                 VALUES ($1, $2, true, $3, $4, $5)
                 ON CONFLICT (site_id)
                 DO UPDATE SET 
                    is_enabled = true,
                    watch_interval = $3,
                    exclude_patterns = $4,
                    max_daily_backups = $5,
                    updated_at = NOW()`,
                [siteId, userId, watchInterval, JSON.stringify(excludePatterns), maxDailyBackups]
            );

            return {
                success: true,
                data: {
                    enabled: true,
                    watchInterval,
                    excludePatterns,
                    maxDailyBackups,
                    message: 'Real-Time Backup aktiviert'
                }
            };
        } catch (error) {
            console.error('Enable real-time backup error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Deaktiviert Real-Time Backup
     */
    async disableRealTimeBackup(siteId, userId) {
        try {
            await query(
                `UPDATE realtime_backup_config 
                 SET is_enabled = false, updated_at = NOW()
                 WHERE site_id = $1 AND user_id = $2`,
                [siteId, userId]
            );

            return {
                success: true,
                message: 'Real-Time Backup deaktiviert'
            };
        } catch (error) {
            console.error('Disable real-time backup error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Stellt einen bestimmten Zeitpunkt wieder her (Point-in-Time Recovery)
     */
    async restoreToPointInTime(siteId, userId, targetTimestamp) {
        try {
            // Finde das passende Backup
            const backupsResult = await query(
                `SELECT * FROM incremental_backups 
                 WHERE site_id = $1 AND status = 'completed' AND completed_at <= $2
                 ORDER BY completed_at DESC`,
                [siteId, targetTimestamp]
            );

            if (backupsResult.rows.length === 0) {
                return { success: false, error: 'Kein Backup für diesen Zeitpunkt gefunden' };
            }

            // Baue die Backup-Kette auf (vom Full-Backup bis zum Ziel)
            const backupChain = await this.buildBackupChain(backupsResult.rows[0]);

            // Erstelle Restore-Job
            const jobResult = await query(
                `INSERT INTO restore_jobs 
                 (site_id, user_id, target_timestamp, backup_chain, status)
                 VALUES ($1, $2, $3, $4, 'pending')
                 RETURNING id`,
                [siteId, userId, targetTimestamp, JSON.stringify(backupChain.map(b => b.id))]
            );

            const jobId = jobResult.rows[0].id;

            // Starte asynchrone Wiederherstellung
            this.processPointInTimeRestore(jobId, siteId, backupChain);

            return {
                success: true,
                data: {
                    jobId,
                    targetTimestamp,
                    backupsToRestore: backupChain.length,
                    message: 'Point-in-Time Wiederherstellung gestartet...'
                }
            };
        } catch (error) {
            console.error('Restore to point in time error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Baut die Backup-Kette vom Full-Backup zum Ziel
     */
    async buildBackupChain(targetBackup) {
        const chain = [targetBackup];
        let currentBackup = targetBackup;

        while (currentBackup.parent_backup_id) {
            const parentResult = await query(
                'SELECT * FROM incremental_backups WHERE id = $1',
                [currentBackup.parent_backup_id]
            );

            if (parentResult.rows.length === 0) break;
            
            currentBackup = parentResult.rows[0];
            chain.unshift(currentBackup); // Am Anfang einfügen
        }

        return chain;
    }

    /**
     * Verarbeitet Point-in-Time Wiederherstellung
     */
    async processPointInTimeRestore(jobId, siteId, backupChain) {
        try {
            await this.updateRestoreJobStatus(jobId, 'running', 'Starte Wiederherstellung...');

            // 1. Stelle Full-Backup wieder her
            const fullBackup = backupChain.find(b => b.backup_type === 'full');
            if (!fullBackup) {
                throw new Error('Kein Full-Backup in der Kette gefunden');
            }

            await this.updateRestoreJobStatus(jobId, 'running', 'Stelle Full-Backup wieder her...');
            await this.delay(3000);

            // 2. Wende inkrementelle Backups an
            const incrementalBackups = backupChain.filter(b => b.backup_type === 'incremental');
            
            for (let i = 0; i < incrementalBackups.length; i++) {
                await this.updateRestoreJobStatus(
                    jobId, 
                    'running', 
                    `Wende inkrementelles Backup ${i + 1}/${incrementalBackups.length} an...`
                );
                await this.delay(1000);
            }

            // 3. Fertig
            await query(
                `UPDATE restore_jobs 
                 SET status = 'completed', completed_at = NOW()
                 WHERE id = $1`,
                [jobId]
            );

            console.log(`Point-in-time restore job ${jobId} completed`);
        } catch (error) {
            console.error('Process point-in-time restore error:', error);
            await this.updateRestoreJobStatus(jobId, 'failed', `Fehler: ${error.message}`);
        }
    }

    /**
     * Holt Backup-Historie für eine Site
     */
    async getBackupHistory(siteId, userId, options = {}) {
        try {
            const { limit = 50, type = null } = options;

            let queryStr = `
                SELECT * FROM incremental_backups 
                WHERE site_id = $1 AND status = 'completed'
            `;
            const params = [siteId];

            if (type) {
                queryStr += ' AND backup_type = $2';
                params.push(type);
            }

            queryStr += ' ORDER BY completed_at DESC LIMIT $' + (params.length + 1);
            params.push(limit);

            const result = await query(queryStr, params);

            // Berechne Gesamtgröße und Recovery Points
            const totalSize = result.rows.reduce((sum, b) => sum + (b.file_size || 0), 0);
            const recoveryPoints = result.rows.map(b => ({
                id: b.id,
                timestamp: b.completed_at,
                type: b.backup_type,
                changes: b.changes_count
            }));

            return {
                success: true,
                data: {
                    backups: result.rows,
                    totalSize,
                    totalSizeFormatted: this.formatBytes(totalSize),
                    recoveryPoints,
                    count: result.rows.length
                }
            };
        } catch (error) {
            console.error('Get backup history error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Holt Real-Time Backup Status
     */
    async getRealTimeBackupStatus(siteId, userId) {
        try {
            const configResult = await query(
                `SELECT * FROM realtime_backup_config WHERE site_id = $1 AND user_id = $2`,
                [siteId, userId]
            );

            if (configResult.rows.length === 0) {
                return {
                    success: true,
                    data: {
                        enabled: false,
                        message: 'Real-Time Backup nicht konfiguriert'
                    }
                };
            }

            const config = configResult.rows[0];

            // Hole letzte Backups heute
            const todayBackupsResult = await query(
                `SELECT COUNT(*) as count FROM incremental_backups 
                 WHERE site_id = $1 AND completed_at >= CURRENT_DATE`,
                [siteId]
            );

            return {
                success: true,
                data: {
                    enabled: config.is_enabled,
                    watchInterval: config.watch_interval,
                    excludePatterns: config.exclude_patterns ? JSON.parse(config.exclude_patterns) : [],
                    maxDailyBackups: config.max_daily_backups,
                    backupsToday: parseInt(todayBackupsResult.rows[0].count),
                    lastUpdated: config.updated_at
                }
            };
        } catch (error) {
            console.error('Get real-time backup status error:', error);
            return { success: false, error: error.message };
        }
    }

    // ==========================================
    // HELPER FUNCTIONS
    // ==========================================

    async getLastFullBackup(siteId) {
        const result = await query(
            `SELECT * FROM incremental_backups 
             WHERE site_id = $1 AND backup_type = 'full' AND status = 'completed'
             ORDER BY completed_at DESC LIMIT 1`,
            [siteId]
        );
        return result.rows[0] || null;
    }

    async getLastBackup(siteId) {
        const result = await query(
            `SELECT * FROM incremental_backups 
             WHERE site_id = $1 AND status = 'completed'
             ORDER BY completed_at DESC LIMIT 1`,
            [siteId]
        );
        return result.rows[0] || null;
    }

    needsFullBackup(lastFullBackup) {
        if (!lastFullBackup) return true;
        
        const daysSinceFullBackup = (Date.now() - new Date(lastFullBackup.completed_at).getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceFullBackup > this.maxDeltaAge;
    }

    async getCurrentFileChecksums(site) {
        // In einer echten Implementierung würde hier das WordPress-Plugin
        // die Checksums aller Dateien senden
        // Hier simulieren wir es
        return {
            'wp-config.php': crypto.randomBytes(16).toString('hex'),
            'wp-content/themes/theme/style.css': crypto.randomBytes(16).toString('hex'),
            'wp-content/plugins/plugin/plugin.php': crypto.randomBytes(16).toString('hex'),
            // ... mehr Dateien
        };
    }

    async getStoredChecksums(backupId) {
        const result = await query(
            `SELECT checksums FROM backup_checksums WHERE backup_id = $1`,
            [backupId]
        );
        if (result.rows.length === 0) return {};
        return typeof result.rows[0].checksums === 'string' 
            ? JSON.parse(result.rows[0].checksums) 
            : result.rows[0].checksums;
    }

    async storeChecksums(backupId, checksums) {
        await query(
            `INSERT INTO backup_checksums (backup_id, checksums) VALUES ($1, $2)
             ON CONFLICT (backup_id) DO UPDATE SET checksums = $2`,
            [backupId, JSON.stringify(checksums)]
        );
    }

    findChangedFiles(previousChecksums, currentChecksums) {
        const added = [];
        const modified = [];
        const deleted = [];

        // Finde neue und geänderte Dateien
        for (const [file, checksum] of Object.entries(currentChecksums)) {
            if (!previousChecksums[file]) {
                added.push(file);
            } else if (previousChecksums[file] !== checksum) {
                modified.push(file);
            }
        }

        // Finde gelöschte Dateien
        for (const file of Object.keys(previousChecksums)) {
            if (!currentChecksums[file]) {
                deleted.push(file);
            }
        }

        return { added, modified, deleted };
    }

    async updateBackupStatus(backupId, status, message) {
        await query(
            `UPDATE incremental_backups SET status = $1, progress_message = $2 WHERE id = $3`,
            [status, message, backupId]
        );
    }

    async updateRestoreJobStatus(jobId, status, message) {
        await query(
            `UPDATE restore_jobs SET status = $1, progress_message = $2 WHERE id = $3`,
            [status, message, jobId]
        );
    }

    formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new IncrementalBackupService();

