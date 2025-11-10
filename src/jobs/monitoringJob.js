const cron = require('node-cron');
const { query } = require('../config/database');
const monitoringService = require('../services/monitoringService');
const alertService = require('../services/alertService');

class MonitoringJob {
    start() {
        console.log('Starting monitoring jobs...');

        cron.schedule('*/5 * * * *', async () => {
            console.log('Running uptime checks...');
            await this.runUptimeChecks();
        });

        console.log('Monitoring jobs started successfully');
    }

    async runUptimeChecks() {
        try {
            const result = await query(
                'SELECT id, domain, site_name, user_id FROM sites WHERE status = $1',
                ['active']
            );

            const sites = result.rows;
            console.log(`Checking uptime for ${sites.length} sites...`);

            for (const site of sites) {
                try {
                    const uptimeResult = await monitoringService.checkUptime(site.id);
                    
                    if (uptimeResult.success && !uptimeResult.data.is_up) {
                        const shouldAlert = await alertService.shouldSendAlert(site.id, 'downtime');
                        
                        if (shouldAlert) {
                            await alertService.sendAlert(site.id, {
                                type: 'downtime',
                                severity: 'high',
                                title: `Site Down: ${site.site_name}`,
                                message: `Ihre WordPress-Site ${site.domain} ist nicht erreichbar.`
                            });
                        }
                    }
                } catch (error) {
                    console.error(`Error checking uptime for site ${site.id}:`, error);
                }
            }
        } catch (error) {
            console.error('Error in runUptimeChecks:', error);
        }
    }
}

module.exports = new MonitoringJob();

