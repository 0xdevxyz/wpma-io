const cron = require('node-cron');
const { client: redis } = require('../config/redis');
const { query } = require('../config/database');
const monitoringService = require('./monitoringService');
const performanceService = require('./performanceService');
const securityService = require('./securityService');

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