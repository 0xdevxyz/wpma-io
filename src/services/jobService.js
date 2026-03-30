const cron = require('node-cron');
const axios = require('axios');
const { client: redis } = require('../config/redis');
const { query } = require('../config/database');
const { logger } = require('../utils/logger');
const monitoringService = require('./monitoringService');
const performanceService = require('./performanceService');
const securityService = require('./securityService');
const sslService = require('./sslService');
const backupService = require('./backupService');
const agentService = require('./agentService');
const { sendMonthlyReports } = require('./monthlyReportService');

class JobService {
    constructor() {
        this.jobs = [];
        this.failedJobCounts = {};
    }

    _recordFailure(jobName, error) {
        this.failedJobCounts[jobName] = (this.failedJobCounts[jobName] || 0) + 1;
        logger.error(`[Job] ${jobName} failed (total failures: ${this.failedJobCounts[jobName]})`, {
            job: jobName,
            error: error?.message || String(error),
            totalFailures: this.failedJobCounts[jobName],
        });
    }

    _resetFailures(jobName) {
        this.failedJobCounts[jobName] = 0;
    }

    async startBackgroundJobs() {
        logger.info('Starting background jobs...');

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

        // Agent autonomous scan — every 15 minutes
        this.jobs.push(
            cron.schedule('*/15 * * * *', () => {
                this.runAgentScans();
            })
        );

        // Monthly report — 1st of each month at 01:00
        this.jobs.push(
            cron.schedule('0 1 1 * *', () => {
                this.runMonthlyReports();
            })
        );

        logger.info('Background jobs started successfully');
    }

    async runUptimeChecks() {
        const jobName = 'uptimeChecks';
        try {
            logger.debug('[Job] Running uptime checks...');
            const result = await query(
                'SELECT id FROM sites WHERE status = $1 LIMIT 50',
                ['active']
            );

            for (const site of result.rows) {
                await monitoringService.checkUptime(site.id);
            }

            this._resetFailures(jobName);
            logger.info(`[Job] Uptime checks completed`, { sitesChecked: result.rows.length });
        } catch (error) {
            this._recordFailure(jobName, error);
        }
    }

    async runPerformanceChecks() {
        const jobName = 'performanceChecks';
        try {
            logger.debug('[Job] Running performance checks...');
            await performanceService.cleanupOldMetrics();
            this._resetFailures(jobName);
            logger.debug('[Job] Performance checks completed');
        } catch (error) {
            this._recordFailure(jobName, error);
        }
    }

    async runSecurityScans() {
        const jobName = 'securityScans';
        try {
            logger.debug('[Job] Running security scans...');
            const result = await query(
                'SELECT id FROM sites WHERE status = $1 LIMIT 50',
                ['active']
            );

            for (const site of result.rows) {
                await securityService.performScan(site.id);
            }

            this._resetFailures(jobName);
            logger.info('[Job] Security scans completed', { sitesScanned: result.rows.length });
        } catch (error) {
            this._recordFailure(jobName, error);
        }
    }

    async runCleanup() {
        const jobName = 'cleanup';
        try {
            logger.debug('[Job] Running cleanup...');
            await performanceService.cleanupOldMetrics();
            await securityService.cleanupOldScans();
            this._resetFailures(jobName);
            logger.info('[Job] Cleanup completed');
        } catch (error) {
            this._recordFailure(jobName, error);
        }
    }

    async runPullHealthChecks() {
        const jobName = 'pullHealthChecks';
        try {
            logger.debug('[Job] Pulling health data from connected WordPress sites...');

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

            this._resetFailures(jobName);
            logger.info('[Job] Pull health checks done', { synced, failed });
        } catch (error) {
            this._recordFailure(jobName, error);
        }
    }

    async runAgentScans() {
        const jobName = 'agentScans';
        try {
            logger.debug('[Job] Running autonomous agent scans...');
            await agentService.scanAllSites();
            this._resetFailures(jobName);
            logger.info('[Job] Agent scans completed');
        } catch (error) {
            this._recordFailure(jobName, error);
        }
    }

    async runMonthlyReports() {
        const jobName = 'monthlyReports';
        try {
            logger.info('[Job] Sending monthly reports...');
            await sendMonthlyReports();
            this._resetFailures(jobName);
            logger.info('[Job] Monthly reports sent');
        } catch (error) {
            this._recordFailure(jobName, error);
        }
    }

    async runSslChecks() {        const jobName = 'sslChecks';
        try {
            logger.debug('[Job] Running SSL certificate checks...');
            const { summary } = await sslService.checkAllSites();
            logger.info('[Job] SSL checks done', {
                valid: summary.valid,
                warning: summary.warning,
                critical: summary.critical,
                expired: summary.expired,
            });

            if (summary.critical > 0 || summary.expired > 0) {
                const criticalSites = await query(
                    `SELECT s.domain, sc.days_remaining, sc.status
                     FROM ssl_certs sc JOIN sites s ON s.id = sc.site_id
                     WHERE sc.status IN ('critical','expired')
                     ORDER BY sc.days_remaining ASC`
                );
                for (const site of criticalSites.rows) {
                    logger.warn('[SSL] Critical certificate', {
                        domain: site.domain,
                        daysRemaining: site.days_remaining,
                        status: site.status,
                    });
                }
            }

            this._resetFailures(jobName);
        } catch (error) {
            this._recordFailure(jobName, error);
        }
    }

    stopAllJobs() {
        this.jobs.forEach(job => job.stop());
        logger.info('All background jobs stopped');
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
