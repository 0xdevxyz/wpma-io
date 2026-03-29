const SslService = require('../services/sslService');
const { query } = require('../config/database');

class SslController {
    async getAll(req, res) {
        try {
            const result = await SslService.getAllSSLStatus();
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getSite(req, res) {
        try {
            const result = await SslService.getSiteSSL(req.params.siteId);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async checkSite(req, res) {
        try {
            const siteResult = await query(
                `SELECT id, site_url FROM sites WHERE id = $1 AND status = 'active'`,
                [req.params.siteId]
            );
            if (siteResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }
            const site = siteResult.rows[0];
            const result = await SslService.checkAndStoreSite(site.id, site.site_url);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async checkAll(req, res) {
        try {
            const result = await SslService.checkAllSites();
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new SslController();
