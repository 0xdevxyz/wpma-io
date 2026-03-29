const monitoringService = require('../services/monitoringService');

class MonitoringController {
    async getUptime(req, res) {
        try {
            const { siteId } = req.params;
            const hours = parseInt(req.query.hours) || 24;
            const result = await monitoringService.getUptimeStats(siteId, hours);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getIncidents(req, res) {
        try {
            const { siteId } = req.params;
            const limit = parseInt(req.query.limit) || 10;
            const result = await monitoringService.getIncidents(siteId, limit);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async checkUptime(req, res) {
        try {
            const { siteId } = req.params;
            const result = await monitoringService.checkUptime(siteId);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new MonitoringController();
