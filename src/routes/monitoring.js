const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const monitoringService = require('../services/monitoringService');

// All routes require authentication
router.use(authenticateToken);

router.get('/:siteId/uptime', async (req, res) => {
    try {
        const { siteId } = req.params;
        const hours = parseInt(req.query.hours) || 24;
        const result = await monitoringService.getUptimeStats(siteId, hours);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/:siteId/incidents', async (req, res) => {
    try {
        const { siteId } = req.params;
        const limit = parseInt(req.query.limit) || 10;
        const result = await monitoringService.getIncidents(siteId, limit);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/:siteId/check', async (req, res) => {
    try {
        const { siteId } = req.params;
        const result = await monitoringService.checkUptime(siteId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router; 