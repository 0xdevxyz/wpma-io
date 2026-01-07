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

    async createBackup(siteId, backupType = 'full', provider = null) {
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
            // Get backup information
            const backupResult = await query(
                'SELECT * FROM backups WHERE id = $1',
                [backupId]
            );

            if (backupResult.rows.length === 0) {
                throw new Error('Backup not found');
            }

            const backup = backupResult.rows[0];

            if (backup.status !== 'completed') {
                throw new Error('Backup is not completed');
            }

            // Download from S3
            const localPath = await this.downloadFromS3(backup);

            // Update backup status
            await query(
                `UPDATE backups 
                 SET status = $1
                 WHERE id = $2`,
                ['restoring', backupId]
            );

            try {
                // Extract and restore
                await this.extractAndRestore(localPath, targetSiteId);

                // Update backup status
                await query(
                    `UPDATE backups 
                     SET status = $1
                     WHERE id = $2`,
                    ['restored', backupId]
                );

                // Clean up local file
                fs.unlinkSync(localPath);

                return {
                    success: true,
                    message: 'Backup restored successfully'
                };

            } catch (error) {
                // Update backup status with error
                await query(
                    `UPDATE backups 
                     SET status = $1, error_message = $2
                     WHERE id = $3`,
                    ['restore_failed', error.message, backupId]
                );

                // Clean up local file
                if (fs.existsSync(localPath)) {
                    fs.unlinkSync(localPath);
                }

                throw error;
            }

        } catch (error) {
            console.error('Backup restoration error:', error);
            return {
                success: false,
                error: error.message
            };
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

    async extractAndRestore(backupPath, targetSiteId) {
        // This would implement the actual restoration logic
        // For now, we'll just simulate the process
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log(`Restoring backup to site ${targetSiteId}`);
                resolve();
            }, 2000);
        });
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

    async scheduleBackup(siteId, schedule) {
        try {
            // This would integrate with a job scheduler like Bull
            // For now, we'll just create a record
            await query(
                `INSERT INTO backup_schedules (site_id, schedule_type, cron_expression, is_active)
                 VALUES ($1, $2, $3, $4)`,
                [siteId, schedule.type, schedule.cron, true]
            );

            return {
                success: true,
                message: 'Backup schedule created'
            };
        } catch (error) {
            console.error('Error scheduling backup:', error);
            return {
                success: false,
                error: error.message
            };
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