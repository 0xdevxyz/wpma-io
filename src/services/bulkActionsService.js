/**
 * Bulk Actions Service
 * Ermöglicht Massenaktionen auf mehreren WordPress-Sites gleichzeitig
 */

const { query } = require('../config/database');
const AutoUpdateService = require('./autoUpdateService');
const backupService = require('./backupService');

class BulkActionsService {
    constructor() {
        this.runningJobs = new Map();
        this.maxConcurrent = 5; // Max parallele Operationen
    }

    /**
     * Führt Bulk-Updates auf mehreren Sites durch
     */
    async bulkUpdate(userId, siteIds, options = {}) {
        const {
            updatePlugins = true,
            updateThemes = true,
            updateCore = false,
            createBackup = true,
            forceUpdate = false
        } = options;

        // Validiere Site-Zugriff
        const accessibleSites = await this.validateSiteAccess(userId, siteIds);
        
        if (accessibleSites.length === 0) {
            return {
                success: false,
                error: 'Keine Berechtigung für die ausgewählten Sites'
            };
        }

        // Erstelle Job-ID für Tracking
        const jobId = `bulk-update-${Date.now()}`;
        
        const job = {
            id: jobId,
            type: 'bulk_update',
            userId,
            totalSites: accessibleSites.length,
            completedSites: 0,
            failedSites: 0,
            status: 'running',
            results: [],
            startedAt: new Date(),
            options
        };

        this.runningJobs.set(jobId, job);

        // Speichere Job in DB
        await this.saveJobToDB(job);

        // Starte asynchrone Verarbeitung
        this.processUpdateJob(jobId, accessibleSites, {
            updatePlugins,
            updateThemes,
            updateCore,
            createBackup,
            forceUpdate
        });

        return {
            success: true,
            data: {
                jobId,
                message: `Bulk-Update gestartet für ${accessibleSites.length} Sites`,
                totalSites: accessibleSites.length
            }
        };
    }

    /**
     * Verarbeitet den Update-Job asynchron
     */
    async processUpdateJob(jobId, sites, options) {
        const job = this.runningJobs.get(jobId);
        const updateTypes = [];
        
        if (options.updatePlugins) updateTypes.push('plugins');
        if (options.updateThemes) updateTypes.push('themes');
        if (options.updateCore) updateTypes.push('core');

        // Verarbeite Sites in Batches
        for (let i = 0; i < sites.length; i += this.maxConcurrent) {
            const batch = sites.slice(i, i + this.maxConcurrent);
            
            const batchPromises = batch.map(async (site) => {
                const result = {
                    siteId: site.id,
                    domain: site.domain,
                    status: 'pending',
                    updates: null,
                    error: null
                };

                try {
                    // Optionales Backup vor Update
                    if (options.createBackup) {
                        await backupService.createBackup(site.id, 'pre_bulk_update');
                    }

                    // Führe Updates durch
                    const updateResult = await AutoUpdateService.performAutoUpdate(site.id, {
                        forceUpdate: options.forceUpdate,
                        updateTypes
                    });

                    if (updateResult.success) {
                        result.status = 'success';
                        result.updates = updateResult.data;
                        job.completedSites++;
                    } else {
                        result.status = 'failed';
                        result.error = updateResult.error || updateResult.data?.message;
                        job.failedSites++;
                    }
                } catch (error) {
                    result.status = 'failed';
                    result.error = error.message;
                    job.failedSites++;
                }

                job.results.push(result);
                await this.updateJobInDB(job);
                
                return result;
            });

            await Promise.all(batchPromises);
        }

        // Job abgeschlossen
        job.status = job.failedSites === 0 ? 'completed' : 'completed_with_errors';
        job.completedAt = new Date();
        await this.updateJobInDB(job);
        
        this.runningJobs.delete(jobId);
    }

    /**
     * Führt Bulk-Backups auf mehreren Sites durch
     */
    async bulkBackup(userId, siteIds, options = {}) {
        const {
            backupType = 'full',
            provider = 'idrive_e2'
        } = options;

        const accessibleSites = await this.validateSiteAccess(userId, siteIds);
        
        if (accessibleSites.length === 0) {
            return {
                success: false,
                error: 'Keine Berechtigung für die ausgewählten Sites'
            };
        }

        const jobId = `bulk-backup-${Date.now()}`;
        
        const job = {
            id: jobId,
            type: 'bulk_backup',
            userId,
            totalSites: accessibleSites.length,
            completedSites: 0,
            failedSites: 0,
            status: 'running',
            results: [],
            startedAt: new Date(),
            options
        };

        this.runningJobs.set(jobId, job);
        await this.saveJobToDB(job);

        // Asynchrone Verarbeitung
        this.processBackupJob(jobId, accessibleSites, { backupType, provider });

        return {
            success: true,
            data: {
                jobId,
                message: `Bulk-Backup gestartet für ${accessibleSites.length} Sites`,
                totalSites: accessibleSites.length
            }
        };
    }

    /**
     * Verarbeitet den Backup-Job asynchron
     */
    async processBackupJob(jobId, sites, options) {
        const job = this.runningJobs.get(jobId);

        for (let i = 0; i < sites.length; i += this.maxConcurrent) {
            const batch = sites.slice(i, i + this.maxConcurrent);
            
            const batchPromises = batch.map(async (site) => {
                const result = {
                    siteId: site.id,
                    domain: site.domain,
                    status: 'pending',
                    backupId: null,
                    error: null
                };

                try {
                    const backupResult = await backupService.createBackup(
                        site.id, 
                        options.backupType,
                        options.provider
                    );

                    if (backupResult.success) {
                        result.status = 'success';
                        result.backupId = backupResult.backupId;
                        job.completedSites++;
                    } else {
                        result.status = 'failed';
                        result.error = backupResult.error;
                        job.failedSites++;
                    }
                } catch (error) {
                    result.status = 'failed';
                    result.error = error.message;
                    job.failedSites++;
                }

                job.results.push(result);
                await this.updateJobInDB(job);
                
                return result;
            });

            await Promise.all(batchPromises);
        }

        job.status = job.failedSites === 0 ? 'completed' : 'completed_with_errors';
        job.completedAt = new Date();
        await this.updateJobInDB(job);
        
        this.runningJobs.delete(jobId);
    }

    /**
     * Installiert ein Plugin auf mehreren Sites
     */
    async bulkInstallPlugin(userId, siteIds, pluginSlug) {
        const accessibleSites = await this.validateSiteAccess(userId, siteIds);
        
        if (accessibleSites.length === 0) {
            return {
                success: false,
                error: 'Keine Berechtigung für die ausgewählten Sites'
            };
        }

        const jobId = `bulk-install-${Date.now()}`;
        
        const job = {
            id: jobId,
            type: 'bulk_install_plugin',
            userId,
            totalSites: accessibleSites.length,
            completedSites: 0,
            failedSites: 0,
            status: 'running',
            results: [],
            startedAt: new Date(),
            options: { pluginSlug }
        };

        this.runningJobs.set(jobId, job);
        await this.saveJobToDB(job);

        // Asynchrone Verarbeitung
        this.processInstallJob(jobId, accessibleSites, pluginSlug);

        return {
            success: true,
            data: {
                jobId,
                message: `Plugin-Installation gestartet auf ${accessibleSites.length} Sites`,
                totalSites: accessibleSites.length
            }
        };
    }

    /**
     * Verarbeitet Plugin-Installation
     */
    async processInstallJob(jobId, sites, pluginSlug) {
        const job = this.runningJobs.get(jobId);

        for (const site of sites) {
            const result = {
                siteId: site.id,
                domain: site.domain,
                status: 'pending',
                error: null
            };

            try {
                // In echter Implementierung: API-Call an WordPress Plugin
                // Hier simuliert
                result.status = 'success';
                job.completedSites++;
            } catch (error) {
                result.status = 'failed';
                result.error = error.message;
                job.failedSites++;
            }

            job.results.push(result);
            await this.updateJobInDB(job);
        }

        job.status = job.failedSites === 0 ? 'completed' : 'completed_with_errors';
        job.completedAt = new Date();
        await this.updateJobInDB(job);
        
        this.runningJobs.delete(jobId);
    }

    /**
     * Deaktiviert ein Plugin auf mehreren Sites
     */
    async bulkDeactivatePlugin(userId, siteIds, pluginSlug) {
        const accessibleSites = await this.validateSiteAccess(userId, siteIds);
        
        const jobId = `bulk-deactivate-${Date.now()}`;
        
        const job = {
            id: jobId,
            type: 'bulk_deactivate_plugin',
            userId,
            totalSites: accessibleSites.length,
            completedSites: 0,
            failedSites: 0,
            status: 'running',
            results: [],
            startedAt: new Date(),
            options: { pluginSlug }
        };

        this.runningJobs.set(jobId, job);
        await this.saveJobToDB(job);

        // Simulierte Verarbeitung
        for (const site of accessibleSites) {
            job.results.push({
                siteId: site.id,
                domain: site.domain,
                status: 'success'
            });
            job.completedSites++;
        }

        job.status = 'completed';
        job.completedAt = new Date();
        await this.updateJobInDB(job);
        this.runningJobs.delete(jobId);

        return {
            success: true,
            data: {
                jobId,
                message: `Plugin deaktiviert auf ${accessibleSites.length} Sites`
            }
        };
    }

    /**
     * Führt Security Scan auf mehreren Sites durch
     */
    async bulkSecurityScan(userId, siteIds) {
        const accessibleSites = await this.validateSiteAccess(userId, siteIds);
        
        const jobId = `bulk-security-${Date.now()}`;
        
        const job = {
            id: jobId,
            type: 'bulk_security_scan',
            userId,
            totalSites: accessibleSites.length,
            completedSites: 0,
            failedSites: 0,
            status: 'running',
            results: [],
            startedAt: new Date()
        };

        this.runningJobs.set(jobId, job);
        await this.saveJobToDB(job);

        // Asynchrone Verarbeitung würde hier starten
        // Für jetzt markieren wir es als gestartet

        return {
            success: true,
            data: {
                jobId,
                message: `Security-Scan gestartet für ${accessibleSites.length} Sites`,
                totalSites: accessibleSites.length
            }
        };
    }

    /**
     * Holt den Status eines laufenden Jobs
     */
    async getJobStatus(jobId, userId) {
        // Prüfe zuerst im Memory
        const runningJob = this.runningJobs.get(jobId);
        if (runningJob) {
            if (runningJob.userId !== userId) {
                return { success: false, error: 'Keine Berechtigung' };
            }
            return { success: true, data: runningJob };
        }

        // Sonst aus DB laden
        try {
            const result = await query(
                `SELECT * FROM bulk_jobs WHERE job_id = $1 AND user_id = $2`,
                [jobId, userId]
            );

            if (result.rows.length === 0) {
                return { success: false, error: 'Job nicht gefunden' };
            }

            const job = result.rows[0];
            return {
                success: true,
                data: {
                    id: job.job_id,
                    type: job.job_type,
                    status: job.status,
                    totalSites: job.total_sites,
                    completedSites: job.completed_sites,
                    failedSites: job.failed_sites,
                    results: job.results ? JSON.parse(job.results) : [],
                    startedAt: job.started_at,
                    completedAt: job.completed_at
                }
            };
        } catch (error) {
            console.error('Get job status error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Holt alle Jobs eines Users
     */
    async getUserJobs(userId, limit = 20) {
        try {
            const result = await query(
                `SELECT * FROM bulk_jobs WHERE user_id = $1 
                 ORDER BY started_at DESC LIMIT $2`,
                [userId, limit]
            );

            return {
                success: true,
                data: result.rows.map(job => ({
                    id: job.job_id,
                    type: job.job_type,
                    status: job.status,
                    totalSites: job.total_sites,
                    completedSites: job.completed_sites,
                    failedSites: job.failed_sites,
                    startedAt: job.started_at,
                    completedAt: job.completed_at
                }))
            };
        } catch (error) {
            console.error('Get user jobs error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Bricht einen laufenden Job ab
     */
    async cancelJob(jobId, userId) {
        const job = this.runningJobs.get(jobId);
        
        if (!job) {
            return { success: false, error: 'Job nicht gefunden oder bereits abgeschlossen' };
        }

        if (job.userId !== userId) {
            return { success: false, error: 'Keine Berechtigung' };
        }

        job.status = 'cancelled';
        job.completedAt = new Date();
        await this.updateJobInDB(job);
        this.runningJobs.delete(jobId);

        return {
            success: true,
            message: 'Job abgebrochen'
        };
    }

    /**
     * Validiert Site-Zugriff für einen User
     */
    async validateSiteAccess(userId, siteIds) {
        try {
            const result = await query(
                `SELECT id, domain, site_url FROM sites 
                 WHERE id = ANY($1) AND user_id = $2`,
                [siteIds, userId]
            );
            return result.rows;
        } catch (error) {
            console.error('Validate site access error:', error);
            return [];
        }
    }

    /**
     * Speichert Job in DB
     */
    async saveJobToDB(job) {
        try {
            await query(
                `INSERT INTO bulk_jobs 
                 (job_id, user_id, job_type, status, total_sites, completed_sites, failed_sites, options, started_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    job.id,
                    job.userId,
                    job.type,
                    job.status,
                    job.totalSites,
                    job.completedSites,
                    job.failedSites,
                    JSON.stringify(job.options || {}),
                    job.startedAt
                ]
            );
        } catch (error) {
            console.error('Save job to DB error:', error);
        }
    }

    /**
     * Aktualisiert Job in DB
     */
    async updateJobInDB(job) {
        try {
            await query(
                `UPDATE bulk_jobs SET 
                 status = $1, 
                 completed_sites = $2, 
                 failed_sites = $3, 
                 results = $4,
                 completed_at = $5
                 WHERE job_id = $6`,
                [
                    job.status,
                    job.completedSites,
                    job.failedSites,
                    JSON.stringify(job.results),
                    job.completedAt || null,
                    job.id
                ]
            );
        } catch (error) {
            console.error('Update job in DB error:', error);
        }
    }

    /**
     * Holt Update-Übersicht für alle Sites eines Users
     */
    async getUpdatesSummary(userId) {
        try {
            const result = await query(
                `SELECT s.id, s.domain, s.site_url,
                        COALESCE(su.update_data, '{}') as update_data
                 FROM sites s
                 LEFT JOIN LATERAL (
                     SELECT update_data FROM site_updates 
                     WHERE site_id = s.id 
                     ORDER BY created_at DESC LIMIT 1
                 ) su ON true
                 WHERE s.user_id = $1`,
                [userId]
            );

            let totalPluginUpdates = 0;
            let totalThemeUpdates = 0;
            let totalCoreUpdates = 0;
            const sitesWithUpdates = [];

            for (const site of result.rows) {
                const updates = typeof site.update_data === 'string' 
                    ? JSON.parse(site.update_data) 
                    : site.update_data;
                
                const pluginCount = updates.plugins?.length || 0;
                const themeCount = updates.themes?.length || 0;
                const hasCore = updates.core ? 1 : 0;

                totalPluginUpdates += pluginCount;
                totalThemeUpdates += themeCount;
                totalCoreUpdates += hasCore;

                if (pluginCount > 0 || themeCount > 0 || hasCore) {
                    sitesWithUpdates.push({
                        id: site.id,
                        domain: site.domain,
                        pluginUpdates: pluginCount,
                        themeUpdates: themeCount,
                        coreUpdate: !!updates.core
                    });
                }
            }

            return {
                success: true,
                data: {
                    summary: {
                        totalSites: result.rows.length,
                        sitesWithUpdates: sitesWithUpdates.length,
                        totalPluginUpdates,
                        totalThemeUpdates,
                        totalCoreUpdates
                    },
                    sites: sitesWithUpdates
                }
            };
        } catch (error) {
            console.error('Get updates summary error:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new BulkActionsService();

