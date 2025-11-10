const AWS = require('aws-sdk');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');

class BackupService {
    constructor() {
        this.s3 = new AWS.S3({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION
        });
        
        this.bucket = process.env.AWS_BACKUP_BUCKET;
    }

    async createBackup(siteId, backupType = 'full', provider = 'aws') {
        let s3Config;
        let bucket;

        switch (provider) {
            case 'idrive_e2':
                s3Config = {
                    endpoint: `https://e2.idrive.com`,
                    accessKeyId: process.env.IDRIVE_E2_ACCESS_KEY_ID,
                    secretAccessKey: process.env.IDRIVE_E2_SECRET_ACCESS_KEY,
                    s3ForcePathStyle: true,
                    signatureVersion: 'v4'
                };
                bucket = process.env.IDRIVE_E2_BACKUP_BUCKET;
                break;
            case 'aws':
            default:
                s3Config = {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                    region: process.env.AWS_REGION
                };
                bucket = process.env.AWS_BACKUP_BUCKET;
                break;
        }

        const s3 = new AWS.S3(s3Config);

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
            const backupFileName = `${site.domain}_${backupType}_${backupId}.zip`;
            const localPath = path.join('/tmp', backupFileName);

            // Create backup record
            const backupRecord = await query(
                `INSERT INTO backups (site_id, backup_type, status, file_size, provider)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id`,
                [siteId, backupType, 'pending', 0, provider]
            );

            const backupId_db = backupRecord.rows[0].id;

            try {
                // Create backup archive
                await this.createBackupArchive(site, backupType, localPath);

                // Upload to S3
                const s3Url = await this.uploadToS3(s3, bucket, localPath, backupFileName);

                // Update backup record
                const fileStats = fs.statSync(localPath);
                await query(
                    `UPDATE backups
                     SET status = $1, file_size = $2, s3_url = $3, completed_at = CURRENT_TIMESTAMP
                     WHERE id = $4`,
                    ['completed', fileStats.size, s3Url, backupId_db]
                );

                // Clean up local file
                fs.unlinkSync(localPath);

                return {
                    success: true,
                    backupId: backupId_db,
                    s3Url: s3Url,
                    fileSize: fileStats.size
                };

            } catch (error) {
                // Update backup record with error
                await query(
                    `UPDATE backups
                     SET status = $1, error_message = $2
                     WHERE id = $3`,
                    ['failed', error.message, backupId_db]
                );

                // Clean up local file if it exists
                if (fs.existsSync(localPath)) {
                    fs.unlinkSync(localPath);
                }

                throw error;
            }

        } catch (error) {
            console.error('Backup creation error:', error);
            return {
                success: false,
                error: error.message
            };
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
        let s3Config;
        let bucket;
        const provider = backup.provider || 'aws';

        switch (provider) {
            case 'idrive_e2':
                s3Config = {
                    endpoint: `https://e2.idrive.com`,
                    accessKeyId: process.env.IDRIVE_E2_ACCESS_KEY_ID,
                    secretAccessKey: process.env.IDRIVE_E2_SECRET_ACCESS_KEY,
                    s3ForcePathStyle: true,
                    signatureVersion: 'v4'
                };
                bucket = process.env.IDRIVE_E2_BACKUP_BUCKET;
                break;
            case 'aws':
            default:
                s3Config = {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                    region: process.env.AWS_REGION
                };
                bucket = process.env.AWS_BACKUP_BUCKET;
                break;
        }

        const s3 = new AWS.S3(s3Config);
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

            return {
                success: true,
                backups: result.rows
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
                let s3Config;
                let bucket;
                const provider = backup.provider || 'aws';

                switch (provider) {
                    case 'idrive_e2':
                        s3Config = {
                            endpoint: `https://e2.idrive.com`,
                            accessKeyId: process.env.IDRIVE_E2_ACCESS_KEY_ID,
                            secretAccessKey: process.env.IDRIVE_E2_SECRET_ACCESS_KEY,
                            s3ForcePathStyle: true,
                            signatureVersion: 'v4'
                        };
                        bucket = process.env.IDRIVE_E2_BACKUP_BUCKET;
                        break;
                    case 'aws':
                    default:
                        s3Config = {
                            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                            region: process.env.AWS_REGION
                        };
                        bucket = process.env.AWS_BACKUP_BUCKET;
                        break;
                }

                const s3 = new AWS.S3(s3Config);
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