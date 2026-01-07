const { query } = require('../config/database');
const axios = require('axios');

class MonitoringService {
    async checkUptime(siteId) {
        try {
            const siteResult = await query('SELECT * FROM sites WHERE id = $1', [siteId]);
            if (siteResult.rows.length === 0) {
                return { success: false, error: 'Site nicht gefunden' };
            }

            const site = siteResult.rows[0];
            const startTime = Date.now();
            
            try {
                const response = await axios.get(site.site_url, {
                    timeout: 30000,
                    validateStatus: (status) => status < 500
                });

                const responseTime = Date.now() - startTime;
                const isUp = response.status >= 200 && response.status < 500;

                await this.saveUptimeCheck(siteId, {
                    is_up: isUp,
                    response_time: responseTime,
                    status_code: response.status,
                    checked_at: new Date()
                });

                return {
                    success: true,
                    data: { is_up: isUp, response_time: responseTime, status_code: response.status }
                };
            } catch (error) {
                await this.saveUptimeCheck(siteId, {
                    is_up: false,
                    response_time: null,
                    status_code: null,
                    error_message: error.message,
                    checked_at: new Date()
                });

                return { success: true, data: { is_up: false, response_time: null, error: error.message } };
            }
        } catch (error) {
            console.error('Error checking uptime:', error);
            return { success: false, error: error.message };
        }
    }

    async saveUptimeCheck(siteId, checkData) {
        try {
            await query(
                `INSERT INTO uptime_checks (
                    site_id, is_up, response_time, status_code, error_message, checked_at
                ) VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    siteId,
                    checkData.is_up,
                    checkData.response_time,
                    checkData.status_code,
                    checkData.error_message || null,
                    checkData.checked_at
                ]
            );
        } catch (error) {
            console.log('Uptime checks table not yet created');
        }
    }

    async getUptimeStats(siteId, hours = 24) {
        try {
            // Sichere parametrisierte Query - verhindert SQL-Injection
            const safeHours = Math.max(1, Math.min(8760, parseInt(hours, 10) || 24));
            const result = await query(
                `SELECT 
                    COUNT(*) as total_checks,
                    SUM(CASE WHEN is_up THEN 1 ELSE 0 END) as up_checks,
                    AVG(response_time) as avg_response_time,
                    MAX(response_time) as max_response_time,
                    MIN(response_time) as min_response_time
                FROM uptime_checks 
                WHERE site_id = $1 
                AND checked_at >= NOW() - MAKE_INTERVAL(hours => $2)`,
                [siteId, safeHours]
            );

            const stats = result.rows[0];
            const uptimePercentage = stats.total_checks > 0 
                ? (stats.up_checks / stats.total_checks) * 100 
                : 100;

            return {
                success: true,
                data: {
                    uptime_percentage: parseFloat(uptimePercentage.toFixed(2)),
                    total_checks: parseInt(stats.total_checks),
                    avg_response_time: stats.avg_response_time ? parseFloat(stats.avg_response_time) : null,
                    max_response_time: stats.max_response_time,
                    min_response_time: stats.min_response_time
                }
            };
        } catch (error) {
            return {
                success: true,
                data: { uptime_percentage: 100, total_checks: 0, avg_response_time: null }
            };
        }
    }

    async getIncidents(siteId, limit = 10) {
        try {
            const result = await query(
                `SELECT * FROM uptime_checks 
                WHERE site_id = $1 AND is_up = false
                ORDER BY checked_at DESC 
                LIMIT $2`,
                [siteId, limit]
            );

            return { success: true, data: result.rows };
        } catch (error) {
            return { success: true, data: [] };
        }
    }
}

module.exports = new MonitoringService();

