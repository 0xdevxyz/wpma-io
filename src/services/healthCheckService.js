const http = require('http');
const https = require('https');
const { query } = require('../config/database');
const { logger } = require('../utils/logger');

class HealthCheckService {
    async checkSite(site) {
        const startTime = Date.now();
        let isUp = false;
        let statusCode = null;
        let responseTime = null;
        let errorMessage = null;

        const urls = [
            `${site.site_url}/wp-json/wpma/v1/health`,
            site.site_url || `https://${site.domain}`
        ].filter(Boolean);

        for (const url of urls) {
            try {
                const result = await this._pingUrl(url);
                statusCode = result.statusCode;
                responseTime = Date.now() - startTime;
                isUp = result.statusCode < 400;
                if (isUp) break;
            } catch (err) {
                errorMessage = err.message;
            }
        }

        responseTime = responseTime || (Date.now() - startTime);

        // In DB speichern
        try {
            await query(
                `INSERT INTO uptime_checks (site_id, status, response_time_ms, status_code, error_message)
                 VALUES ($1, $2, $3, $4, $5)`,
                [site.id, isUp ? 'up' : 'down', responseTime, statusCode, errorMessage]
            );
            await query(
                `UPDATE sites SET last_uptime_check = NOW(), uptime_status = $1 WHERE id = $2`,
                [isUp ? 'up' : 'down', site.id]
            );
        } catch (dbErr) {
            logger.error('Health check DB error:', { error: dbErr.message });
        }

        return { isUp, statusCode, responseTime, errorMessage };
    }

    _pingUrl(url) {
        return new Promise((resolve, reject) => {
            const lib = url.startsWith('https') ? https : http;
            const req = lib.get(url, { timeout: 10000 }, (res) => {
                res.resume();
                resolve({ statusCode: res.statusCode });
            });
            req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
            req.on('error', reject);
        });
    }
}

module.exports = new HealthCheckService();
