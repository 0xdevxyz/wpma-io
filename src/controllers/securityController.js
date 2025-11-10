const securityService = require('../services/securityService');
const { query } = require('../config/database');

class SecurityController {
    async getStatus(req, res) {
        try {
            const { siteId } = req.params;
            const siteCheck = await query(
                'SELECT id FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, req.user.id]
            );

            if (siteCheck.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            const result = await securityService.getLatestScan(siteId);
            res.json(result);
        } catch (error) {
            console.error('Error in getStatus:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async startScan(req, res) {
        try {
            const { siteId } = req.params;
            const scanData = req.body;

            if (scanData && Object.keys(scanData).length > 0) {
                const siteCheck = await query('SELECT id, user_id FROM sites WHERE id = $1', [siteId]);

                if (siteCheck.rows.length === 0) {
                    return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
                }

                const result = await securityService.saveScanResults(siteId, scanData);
                
                if (result.success && req.io) {
                    const site = siteCheck.rows[0];
                    req.io.to(`user_${site.user_id}`).emit('security_update', {
                        siteId: siteId,
                        scan: result.data
                    });
                }

                return res.json(result);
            }

            const siteCheck = await query(
                'SELECT id FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, req.user.id]
            );

            if (siteCheck.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            const result = await securityService.performScan(siteId);
            res.json(result);
        } catch (error) {
            console.error('Error in startScan:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getVulnerabilities(req, res) {
        try {
            const { siteId } = req.params;
            const siteCheck = await query(
                'SELECT id FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, req.user.id]
            );

            if (siteCheck.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            const result = await securityService.analyzeSecurityIssues(siteId);
            res.json(result);
        } catch (error) {
            console.error('Error in getVulnerabilities:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getHistory(req, res) {
        try {
            const { siteId } = req.params;
            const limit = parseInt(req.query.limit) || 10;
            const siteCheck = await query(
                'SELECT id FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, req.user.id]
            );

            if (siteCheck.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            const result = await securityService.getAllScans(siteId, limit);
            res.json(result);
        } catch (error) {
            console.error('Error in getHistory:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getStatistics(req, res) {
        try {
            const { siteId } = req.params;
            const siteCheck = await query(
                'SELECT id FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, req.user.id]
            );

            if (siteCheck.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            const result = await securityService.getStatistics(siteId);
            res.json(result);
        } catch (error) {
            console.error('Error in getStatistics:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new SecurityController();

