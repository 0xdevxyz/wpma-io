const AWS = require('aws-sdk');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');

class BackupService {
    constructor() {
        // Standard-Provider ermitteln
        this.defaultProvider = process.env.IDRIVE_E2_ACCESS_KEY ? 'idrive_e2' : 'aws';
        
        console.log(`BackupService initialized. Default provider: ${this.defaultProvider}`);
    }

    /**
     * Erstellt S3-Client basierend auf Provider
     */
    getS3Client(provider) {
        switch (provider) {
            case 'idrive_e2':
                // Stelle sicher, dass der Endpoint https:// hat
                let endpoint = process.env.IDRIVE_E2_ENDPOINT || 'e2.idrivee2.com';
                if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
                    endpoint = 'https://' + endpoint;
                }
                return {
                    client: new AWS.S3({
                        endpoint: endpoint,
                        accessKeyId: process.env.IDRIVE_E2_ACCESS_KEY,
                        secretAccessKey: process.env.IDRIVE_E2_SECRET_KEY,
                        s3ForcePathStyle: true,
                        signatureVersion: 'v4',
                        region: process.env.IDRIVE_E2_REGION || 'e2'
                    }),
                    bucket: process.env.IDRIVE_E2_BUCKET
                };
            case 'aws':
            default:
                return {
                    client: new AWS.S3({
                        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                        region: process.env.AWS_REGION || 'eu-central-1'
                    }),
                    bucket: process.env.AWS_S3_BUCKET
                };
        }
    }

    async createBackup(siteId, backupType = 'full', provider = null, userId = null) {
        // Quota enforcement (best-effort – skip if userId not provided)
        if (userId) await this.enforceQuota(siteId, userId);

        // Verwende Standard-Provider wenn keiner angegeben
        provider = provider || this.defaultProvider;
        
        const { client: s3, bucket } = this.getS3Client(provider);
        
        if (!bucket) {
            return {
                success: false,
                error: `Backup-Bucket nicht konfiguriert für Provider: ${provider}`
            };
        }

        try {
            // Get site information
            const siteResult = await query(
                'SELECT * FROM sites WHERE id = $1',
                [siteId]
            );

            if (siteResult.rows.length === 0) {
                throw new Error('Site not found');
            }

            const site = siteResult.rows[0];
            const backupId = this.generateBackupId();

            // Create backup record
            const backupRecord = await query(
                `INSERT INTO backups (site_id, backup_type, status, file_size, provider)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id`,
                [siteId, backupType, 'pending', 0, provider]
            );

            const backupId_db = backupRecord.rows[0].id;

            // Trigger backup on WordPress site via plugin API
            const backupResult = await this.triggerRemoteBackup(site, backupType, backupId, provider, bucket);

            if (backupResult.success) {
                // Update backup record with result from plugin
                await query(
                    `UPDATE backups
                     SET status = $1, file_size = $2, s3_url = $3, completed_at = CURRENT_TIMESTAMP
                     WHERE id = $4`,
                    ['completed', backupResult.fileSize, backupResult.s3Url, backupId_db]
                );

                return {
                    success: true,
                    backupId: backupId_db,
                    s3Url: backupResult.s3Url,
                    fileSize: backupResult.fileSize
                };
            } else {
                // Plugin konnte nicht erreicht werden - markiere als "wartend auf Plugin"
                await query(
                    `UPDATE backups
                     SET status = $1, error_message = $2
                     WHERE id = $3`,
                    ['waiting_for_plugin', 'Warte auf WordPress-Plugin. Bitte stelle sicher, dass das Plugin aktiv ist.', backupId_db]
                );

                return {
                    success: true,
                    backupId: backupId_db,
                    status: 'waiting_for_plugin',
                    message: 'Backup-Anfrage erstellt. Das WordPress-Plugin wird das Backup durchführen.'
                };
            }

        } catch (error) {
            console.error('Backup creation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Triggert Backup auf der WordPress-Site über das Plugin
     */
    async triggerRemoteBackup(site, backupType, backupId, provider, bucket) {
        try {
            // Versuche das WordPress-Plugin zu erreichen
            const pluginUrl = `${site.site_url}/wp-json/wpma/v1/backup/create`;
            
            const response = await fetch(pluginUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WPMA-API-Key': site.api_key
                },
                body: JSON.stringify({
                    backup_type: backupType,
                    backup_id: backupId,
                    provider: provider,
                    bucket: bucket,
                    upload_credentials: {
                        endpoint: process.env.IDRIVE_E2_ENDPOINT,
                        access_key: process.env.IDRIVE_E2_ACCESS_KEY,
                        secret_key: process.env.IDRIVE_E2_SECRET_KEY,
                        region: process.env.IDRIVE_E2_REGION
                    }
                }),
                timeout: 10000
            });

            if (response.ok) {
                const data = await response.json();
                return {
                    success: true,
                    fileSize: data.file_size || 0,
                    s3Url: data.s3_url || null
                };
            }

            return { success: false, error: 'Plugin nicht erreichbar' };
        } catch (error) {
            console.log('Remote backup trigger failed (Plugin may not be installed):', error.message);
            return { success: false, error: error.message };
        }
    }

    async createBackupArchive(site, backupType, outputPath) {
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(outputPath);
            const archive = archiver('zip', {
                zlib: { level: 9 } // Maximum compression
            });

            output.on('close', () => {
                resolve();
            });

            archive.on('error', (err) => {
                reject(err);
            });

            archive.pipe(output);

            if (backupType === 'full') {
                // Add WordPress files
                archive.directory('/var/www/html/', 'wordpress/');
                
                // Add database dump
                this.addDatabaseDump(archive, site);
                
            } else if (backupType === 'database') {
                // Database only
                this.addDatabaseDump(archive, site);
                
            } else if (backupType === 'files') {
                // Files only
                archive.directory('/var/www/html/', 'wordpress/');
            }

            archive.finalize();
        });
    }

    async addDatabaseDump(archive, site) {
        try {
            // Create database dump
            const dumpFileName = `database_${Date.now()}.sql`;
            const dumpPath = `/tmp/${dumpFileName}`;

            // This would need to be implemented based on your database setup
            // For now, we'll create a placeholder
            const dumpContent = `-- Database dump for ${site.domain}
-- Generated on ${new Date().toISOString()}
-- This is a placeholder dump file
`;

            fs.writeFileSync(dumpPath, dumpContent);
            archive.file(dumpPath, { name: 'database/dump.sql' });

            // Clean up dump file
            setTimeout(() => {
                if (fs.existsSync(dumpPath)) {
                    fs.unlinkSync(dumpPath);
                }
            }, 1000);

        } catch (error) {
            console.error('Database dump error:', error);
        }
    }

    async uploadToS3(s3, bucket, filePath, fileName) {
        const fileStream = fs.createReadStream(filePath);
        
        const uploadParams = {
            Bucket: bucket,
            Key: `backups/${fileName}`,
            Body: fileStream,
            ContentType: 'application/zip',
            Metadata: {
                'backup-date': new Date().toISOString(),
                'backup-type': 'wordpress'
            }
        };

        const result = await s3.upload(uploadParams).promise();
        return result.Location;
    }

    async restoreBackup(backupId, targetSiteId) {
        try {
            const backupResult = await query('SELECT * FROM backups WHERE id = $1', [backupId]);
            if (backupResult.rows.length === 0) throw new Error('Backup nicht gefunden');

            const backup = backupResult.rows[0];
            if (backup.status !== 'completed') throw new Error('Backup ist nicht abgeschlossen');

            // Status auf "restoring" setzen
            await query(`UPDATE backups SET status = $1 WHERE id = $2`, ['restoring', backupId]);

            try {
                // S3-Key aus gespeicherter URL ableiten
                const s3Key = backup.s3_url
                    ? `backups/${path.basename(backup.s3_url.split('?')[0])}`
                    : null;
                if (!s3Key) throw new Error('Kein S3-Key für dieses Backup');

                await this.extractAndRestore(s3Key, targetSiteId);

                await query(`UPDATE backups SET status = $1 WHERE id = $2`, ['restored', backupId]);

                return { success: true, message: 'Restore wurde beim Agenten gestartet' };

            } catch (error) {
                await query(
                    `UPDATE backups SET status = $1, error_message = $2 WHERE id = $3`,
                    ['restore_failed', error.message, backupId]
                );
                throw error;
            }

        } catch (error) {
            console.error('Backup restoration error:', error);
            return { success: false, error: error.message };
        }
    }

    async downloadFromS3(backup) {
        const provider = backup.provider || this.defaultProvider;
        const { client: s3, bucket } = this.getS3Client(provider);
        const fileName = path.basename(backup.s3_url);
        const localPath = `/tmp/${fileName}`;

        const downloadParams = {
            Bucket: bucket,
            Key: `backups/${fileName}`
        };

        const fileStream = fs.createWriteStream(localPath);
        const s3Stream = s3.getObject(downloadParams).createReadStream();

        return new Promise((resolve, reject) => {
            s3Stream.pipe(fileStream);
            fileStream.on('finish', () => resolve(localPath));
            fileStream.on('error', reject);
        });
    }

    /**
     * Echter Restore: Generiert Pre-Signed URL und sendet sie an den WP-Agent.
     * Der Agent lädt das Backup selbst herunter und stellt es wieder her.
     */
    async extractAndRestore(backupPath, targetSiteId) {
        // backupPath ist hier der lokale /tmp/-Pfad ODER eine S3-URL
        // Hole Site-Info + Backup-Record
        const siteResult = await query('SELECT * FROM sites WHERE id = $1', [targetSiteId]);
        if (siteResult.rows.length === 0) throw new Error('Site nicht gefunden');
        const site = siteResult.rows[0];

        // Ermittle S3-Key aus Pfad
        const fileName = require('path').basename(backupPath);
        const s3Key = `backups/${fileName}`;

        // Pre-Signed URL erzeugen (gültig 30 Minuten)
        const { client: s3 } = this.getS3Client(this.defaultProvider);
        const downloadUrl = await new Promise((resolve, reject) => {
            s3.getSignedUrl('getObject', {
                Bucket: process.env.IDRIVE_E2_BUCKET,
                Key: s3Key,
                Expires: 1800
            }, (err, url) => err ? reject(err) : resolve(url));
        });

        // Agent-Endpoint aufrufen
        const restoreUrl = `${site.site_url}/wp-json/wpma/v1/backup/restore`;
        const response = await fetch(restoreUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WPMA-API-Key': site.api_key
            },
            body: JSON.stringify({ download_url: downloadUrl, restore_type: 'full' }),
            signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`Agent-Restore fehlgeschlagen (HTTP ${response.status}): ${text.slice(0, 200)}`);
        }

        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Agent meldete Fehler beim Restore');

        console.log(`Restore für Site ${targetSiteId} gestartet, Job-ID: ${data.restore_id}`);
    }

    async getBackups(siteId) {
        try {
            const result = await query(
                `SELECT * FROM backups 
                 WHERE site_id = $1 
                 ORDER BY created_at DESC`,
                [siteId]
            );

            // Konvertiere zu camelCase für Frontend
            const data = result.rows.map(row => ({
                id: row.id,
                siteId: row.site_id,
                backupType: row.backup_type,
                status: row.status,
                fileSize: parseInt(row.file_size) || 0,
                s3Url: row.s3_url,
                errorMessage: row.error_message,
                provider: row.provider,
                createdAt: row.created_at,
                completedAt: row.completed_at
            }));

            return {
                success: true,
                data: data,
                backups: data  // Legacy-Kompatibilität
            };
        } catch (error) {
            console.error('Error getting backups:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async deleteBackup(backupId) {
        try {
            // Get backup information
            const backupResult = await query(
                'SELECT * FROM backups WHERE id = $1',
                [backupId]
            );

            if (backupResult.rows.length === 0) {
                throw new Error('Backup not found');
            }

            const backup = backupResult.rows[0];

            // Delete from S3 if exists
            if (backup.s3_url) {
                const provider = backup.provider || this.defaultProvider;
                const { client: s3, bucket } = this.getS3Client(provider);
                const fileName = path.basename(backup.s3_url);
                await this.deleteFromS3(s3, bucket, fileName);
            }

            // Delete from database
            await query(
                'DELETE FROM backups WHERE id = $1',
                [backupId]
            );

            return {
                success: true,
                message: 'Backup deleted successfully'
            };

        } catch (error) {
            console.error('Error deleting backup:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async deleteFromS3(s3, bucket, fileName) {
        try {
            const deleteParams = {
                Bucket: bucket,
                Key: `backups/${fileName}`
            };

            await s3.deleteObject(deleteParams).promise();
        } catch (error) {
            console.error('Error deleting from S3:', error);
        }
    }

    // ── Schedule management ─────────────────────────────────────────────────

    async getSchedule(siteId) {
        try {
            const result = await query(
                'SELECT * FROM backup_schedules WHERE site_id = $1',
                [siteId]
            );
            return { success: true, data: result.rows[0] || null };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async setSchedule(siteId, { scheduleType, backupType = 'full', hour = 2, dayOfWeek = 1, dayOfMonth = 1 }) {
        try {
            const nextRun = scheduleType === 'off' ? null : this._calcNextRun({ schedule_type: scheduleType, hour, day_of_week: dayOfWeek, day_of_month: dayOfMonth });

            const result = await query(
                `INSERT INTO backup_schedules
                    (site_id, schedule_type, backup_type, hour, day_of_week, day_of_month, is_active, next_run_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
                 ON CONFLICT (site_id) DO UPDATE SET
                    schedule_type = EXCLUDED.schedule_type,
                    backup_type   = EXCLUDED.backup_type,
                    hour          = EXCLUDED.hour,
                    day_of_week   = EXCLUDED.day_of_week,
                    day_of_month  = EXCLUDED.day_of_month,
                    is_active     = EXCLUDED.is_active,
                    next_run_at   = EXCLUDED.next_run_at,
                    updated_at    = CURRENT_TIMESTAMP
                 RETURNING *`,
                [siteId, scheduleType, backupType, hour, dayOfWeek, dayOfMonth, scheduleType !== 'off', nextRun]
            );
            return { success: true, data: result.rows[0] };
        } catch (error) {
            console.error('Error setting backup schedule:', error);
            return { success: false, error: error.message };
        }
    }

    _calcNextRun({ schedule_type, hour, day_of_week, day_of_month }) {
        const now = new Date();
        const next = new Date(now);
        next.setMinutes(0, 0, 0);
        next.setUTCHours(hour);

        if (schedule_type === 'daily') {
            if (next <= now) next.setDate(next.getDate() + 1);
        } else if (schedule_type === 'weekly') {
            const target = day_of_week ?? 1;
            let diff = (target - now.getDay() + 7) % 7 || 7;
            next.setDate(now.getDate() + diff);
            if (next <= now) next.setDate(next.getDate() + 7);
        } else if (schedule_type === 'monthly') {
            next.setDate(day_of_month ?? 1);
            if (next <= now) next.setMonth(next.getMonth() + 1);
        }
        return next;
    }

    // ── Quota management ────────────────────────────────────────────────────

    static QUOTA_TIERS = [
        { tier: 1, bytes: 1  * 1024 * 1024 * 1024, label: '1 GB'  },
        { tier: 2, bytes: 2  * 1024 * 1024 * 1024, label: '2 GB'  },
        { tier: 3, bytes: 5  * 1024 * 1024 * 1024, label: '5 GB'  },
        { tier: 4, bytes: 10 * 1024 * 1024 * 1024, label: '10 GB' },
    ];

    async getOrCreateQuota(userId) {
        let result = await query('SELECT * FROM backup_storage_quotas WHERE user_id = $1', [userId]);
        if (result.rows.length === 0) {
            result = await query(
                `INSERT INTO backup_storage_quotas (user_id) VALUES ($1) RETURNING *`,
                [userId]
            );
        }
        return result.rows[0];
    }

    async getQuota(userId) {
        try {
            const quota = await this.getOrCreateQuota(userId);
            // Recalculate used_bytes from actual backups
            const used = await query(
                `SELECT COALESCE(SUM(b.file_size), 0) AS total
                 FROM backups b
                 JOIN sites s ON s.id = b.site_id
                 WHERE s.user_id = $1 AND b.status = 'completed'`,
                [userId]
            );
            const usedBytes = parseInt(used.rows[0].total) || 0;
            // Update stored value
            await query(
                `UPDATE backup_storage_quotas SET used_bytes = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
                [usedBytes, userId]
            );
            const tier = BackupService.QUOTA_TIERS.find(t => t.tier === quota.tier) || BackupService.QUOTA_TIERS[0];
            return {
                success: true,
                data: {
                    quotaBytes: quota.quota_bytes,
                    usedBytes,
                    maxBackupsPerSite: quota.max_backups_per_site,
                    tier: quota.tier,
                    tierLabel: tier.label,
                    nextTier: BackupService.QUOTA_TIERS.find(t => t.tier === quota.tier + 1) || null,
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async upgradeQuota(userId) {
        try {
            const quota = await this.getOrCreateQuota(userId);
            const currentTier = quota.tier;
            const nextTierDef = BackupService.QUOTA_TIERS.find(t => t.tier === currentTier + 1);
            if (!nextTierDef) return { success: false, error: 'Maximales Speicher-Tier bereits erreicht' };

            await query(
                `UPDATE backup_storage_quotas
                 SET tier = $1, quota_bytes = $2, updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $3`,
                [nextTierDef.tier, nextTierDef.bytes, userId]
            );
            return { success: true, data: { tier: nextTierDef.tier, quotaBytes: nextTierDef.bytes, label: nextTierDef.label } };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Enforces the per-site max-backup limit and the per-user storage quota.
     * Deletes oldest completed backups as needed before a new backup is created.
     */
    async enforceQuota(siteId, userId) {
        try {
            const quota = await this.getOrCreateQuota(userId);

            // 1. Enforce max backups per site (rotate oldest)
            const siteBackups = await query(
                `SELECT id, file_size FROM backups
                 WHERE site_id = $1 AND status = 'completed'
                 ORDER BY created_at ASC`,
                [siteId]
            );
            const maxPerSite = quota.max_backups_per_site || 5;
            if (siteBackups.rows.length >= maxPerSite) {
                const toDelete = siteBackups.rows.slice(0, siteBackups.rows.length - maxPerSite + 1);
                for (const b of toDelete) await this.deleteBackup(b.id);
            }

            // 2. Enforce total user quota (delete oldest across all sites)
            const usedResult = await query(
                `SELECT COALESCE(SUM(b.file_size), 0) AS total
                 FROM backups b JOIN sites s ON s.id = b.site_id
                 WHERE s.user_id = $1 AND b.status = 'completed'`,
                [userId]
            );
            let usedBytes = parseInt(usedResult.rows[0].total) || 0;
            const quotaBytes = quota.quota_bytes;

            if (usedBytes >= quotaBytes) {
                // Delete oldest backups across all user sites until we have headroom
                const allBackups = await query(
                    `SELECT b.id, b.file_size
                     FROM backups b JOIN sites s ON s.id = b.site_id
                     WHERE s.user_id = $1 AND b.status = 'completed'
                     ORDER BY b.created_at ASC`,
                    [userId]
                );
                for (const b of allBackups.rows) {
                    if (usedBytes < quotaBytes) break;
                    await this.deleteBackup(b.id);
                    usedBytes -= parseInt(b.file_size) || 0;
                }
            }

            return { success: true };
        } catch (error) {
            console.error('enforceQuota error:', error);
            return { success: false, error: error.message };
        }
    }

    // ── Scheduled backup runner (called by jobService) ───────────────────────

    async runDueScheduledBackups() {
        try {
            const due = await query(
                `SELECT bs.*, s.user_id
                 FROM backup_schedules bs
                 JOIN sites s ON s.id = bs.site_id
                 WHERE bs.is_active = true
                   AND bs.schedule_type != 'off'
                   AND bs.next_run_at <= CURRENT_TIMESTAMP`,
            );

            for (const sched of due.rows) {
                console.log(`[Backup] Scheduled backup for site ${sched.site_id}`);
                await this.enforceQuota(sched.site_id, sched.user_id);
                await this.createBackup(sched.site_id, sched.backup_type);

                const nextRun = this._calcNextRun(sched);
                await query(
                    `UPDATE backup_schedules
                     SET last_run_at = CURRENT_TIMESTAMP, next_run_at = $1, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $2`,
                    [nextRun, sched.id]
                );
            }
        } catch (error) {
            console.error('[Backup] runDueScheduledBackups error:', error);
        }
    }

    generateBackupId() {
        return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async cleanupOldBackups(siteId, retentionDays = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

            const result = await query(
                `SELECT id, s3_url FROM backups 
                 WHERE site_id = $1 AND created_at < $2 AND status = 'completed'`,
                [siteId, cutoffDate]
            );

            for (const backup of result.rows) {
                await this.deleteBackup(backup.id);
            }

            return {
                success: true,
                deletedCount: result.rows.length
            };
        } catch (error) {
            console.error('Error cleaning up old backups:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new BackupService();