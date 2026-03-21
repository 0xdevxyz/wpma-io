const cron = require('node-cron');
const axios = require('axios');
const { client: redis } = require('../config/redis');
const { query } = require('../config/database');
const monitoringService = require('./monitoringService');
const performanceService = require('./performanceService');
const securityService = require('./securityService');
const sslService = require('./sslService');
const backupService = require('./backupService');

class JobService {
    constructor() {
        this.jobs = [];
    }
    
    async startBackgroundJobs() {
        console.log('Starting background jobs...');
        
        // Uptime monitoring - every 5 minutes
        this.jobs.push(
            cron.schedule('*/5 * * * *', () => {
                this.runUptimeChecks();
            })
        );
        
        // Performance cleanup - every 30 minutes
        this.jobs.push(
            cron.schedule('*/30 * * * *', () => {
                this.runPerformanceChecks();
            })
        );
        
        // Security scan job - daily at 2 AM
        this.jobs.push(
            cron.schedule('0 2 * * *', () => {
                this.runSecurityScans();
            })
        );
        
        // Cleanup old data - daily at 4 AM
        this.jobs.push(
            cron.schedule('0 4 * * *', () => {
                this.runCleanup();
            })
        );

        // Pull health from all connected WordPress sites — every 30 minutes
        this.jobs.push(
            cron.schedule('*/30 * * * *', () => {
                this.runPullHealthChecks();
            })
        );

        // SSL-Zertifikat-Check — täglich um 3 Uhr
        this.jobs.push(
            cron.schedule('0 3 * * *', () => {
                this.runSslChecks();
            })
        );

        // SSL-Check beim Start (einmalig, verzögert)
        setTimeout(() => this.runSslChecks(), 60 * 1000);

        // Scheduled auto-backups — check every minute
        this.jobs.push(
            cron.schedule('* * * * *', () => {
                backupService.runDueScheduledBackups();
            })
        );

        console.log('Background jobs started successfully');
    }
    
    async runUptimeChecks() {
        try {
            console.log('[Job] Running uptime checks...');
            const result = await query(
                'SELECT id FROM sites WHERE status = $1 LIMIT 50',
                ['active']
            );
            
            for (const site of result.rows) {
                await monitoringService.checkUptime(site.id);
            }
            
            console.log(`[Job] Checked uptime for ${result.rows.length} sites`);
        } catch (error) {
            console.error('[Job] Uptime check error:', error);
        }
    }
    
    async runPerformanceChecks() {
        try {
            console.log('[Job] Running performance checks...');
            await performanceService.cleanupOldMetrics();
        } catch (error) {
            console.error('[Job] Performance check error:', error);
        }
    }
    
    async runSecurityScans() {
        try {
            console.log('[Job] Running security scans...');
            const result = await query(
                'SELECT id FROM sites WHERE status = $1 LIMIT 50',
                ['active']
            );
            
            for (const site of result.rows) {
                await securityService.performScan(site.id);
            }
            
            console.log(`[Job] Scanned ${result.rows.length} sites`);
        } catch (error) {
            console.error('[Job] Security scan error:', error);
        }
    }
    
    async runCleanup() {
        try {
            console.log('[Job] Running cleanup...');
            await performanceService.cleanupOldMetrics();
            await securityService.cleanupOldScans();
            console.log('[Job] Cleanup completed');
        } catch (error) {
            console.error('[Job] Cleanup error:', error);
        }
    }
    
    async runPullHealthChecks() {
        try {
            console.log('[Job] Pulling health data from connected WordPress sites...');

            const result = await query(
                `SELECT id, domain, site_url, api_key
                   FROM sites
                  WHERE status = 'active'
                    AND last_plugin_connection IS NOT NULL
                  LIMIT 100`
            );

            let synced = 0;
            let failed = 0;

            for (const site of result.rows) {
                try {
                    const siteUrl = (site.site_url || '').replace(/\/$/, '');
                    const res = await axios.get(`${siteUrl}/wp-json/wpma/v1/health`, {
                        headers: { 'X-WPMA-Key': site.api_key || '', 'User-Agent': 'WPMA-Backend/1.0' },
                        timeout: 15000,
                        validateStatus: null,
                    });

                    if (res.status === 200 && res.data) {
                        const health       = res.data;
                        const totalUpdates = health.total_updates || 0;
                        await query(
                            `UPDATE sites
                                SET health_score      = $1,
                                    wordpress_version = $2,
                                    php_version       = $3,
                                    update_count      = $4,
                                    last_check        = CURRENT_TIMESTAMP,
                                    updated_at        = CURRENT_TIMESTAMP
                              WHERE id = $5`,
                            [health.health_score ?? null, health.wordpress_version ?? null, health.php_version ?? null, totalUpdates, site.id]
                        );
                        synced++;
                    } else {
                        failed++;
                    }
                } catch (_) {
                    failed++;
                }
            }

            console.log(`[Job] Pull health checks done: ${synced} synced, ${failed} failed`);
        } catch (error) {
            console.error('[Job] Pull health check error:', error.message);
        }
    }

    async runSslChecks() {
        try {
            console.log('[Job] Running SSL certificate checks...');
            const { summary } = await sslService.checkAllSites();
            console.log(`[Job] SSL checks done — valid: ${summary.valid}, warning: ${summary.warning}, critical: ${summary.critical}, expired: ${summary.expired}`);

            // Benachrichtigung bei kritischen/abgelaufenen Zertifikaten
            if (summary.critical > 0 || summary.expired > 0) {
                const criticalSites = await query(
                    `SELECT s.domain, sc.days_remaining, sc.status
                     FROM ssl_certs sc JOIN sites s ON s.id = sc.site_id
                     WHERE sc.status IN ('critical','expired')
                     ORDER BY sc.days_remaining ASC`
                );
                for (const site of criticalSites.rows) {
                    console.warn(`[SSL] KRITISCH: ${site.domain} — ${site.days_remaining} Tage verbleibend (${site.status})`);
                }
            }
        } catch (error) {
            console.error('[Job] SSL check error:', error.message);
        }
    }

    stopAllJobs() {
        this.jobs.forEach(job => job.stop());
        console.log('All background jobs stopped');
    }
}

const jobService = new JobService();

const startBackgroundJobs = async () => {
    await jobService.startBackgroundJobs();
};

module.exports = {
    startBackgroundJobs,
    jobService
}; 