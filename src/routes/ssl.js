const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const SslService = require('../services/sslService');

router.use(authenticateToken);

// GET /api/v1/ssl — SSL-Status aller aktiven Sites
router.get('/', async (req, res) => {
    try {
        const result = await SslService.getAllSSLStatus();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/ssl/:siteId — SSL-Status einer Site
router.get('/:siteId', async (req, res) => {
    try {
        const result = await SslService.getSiteSSL(req.params.siteId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/ssl/:siteId/check — Sofort-Check (on-demand)
router.post('/:siteId/check', async (req, res) => {
    try {
        const siteResult = await require('../config/database').query(
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
});

// POST /api/v1/ssl/check-all — Alle Sites prüfen (Admin)
router.post('/check-all', async (req, res) => {
    try {
        const result = await SslService.checkAllSites();
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
