const performanceService = require('../services/performanceService');
const { query } = require('../config/database');

class PerformanceController {
    async getMetrics(req, res) {
        try {
            const { siteId } = req.params;
            const siteCheck = await query(
                'SELECT id FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, req.user.id]
            );

            if (siteCheck.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            const result = await performanceService.getCurrentMetrics(siteId);
            if (!result.success) return res.status(404).json(result);
            res.json(result);
        } catch (error) {
            console.error('Error in getMetrics:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getHistory(req, res) {
        try {
            const { siteId } = req.params;
            const days = parseInt(req.query.days) || 7;
            const siteCheck = await query(
                'SELECT id FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, req.user.id]
            );

            if (siteCheck.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            const result = await performanceService.getMetricsHistory(siteId, days);
            res.json(result);
        } catch (error) {
            console.error('Error in getHistory:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async analyze(req, res) {
        try {
            const { siteId } = req.params;
            const siteCheck = await query(
                'SELECT id FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, req.user.id]
            );

            if (siteCheck.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            const result = await performanceService.analyzePerformance(siteId);
            res.json(result);
        } catch (error) {
            console.error('Error in analyze:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getRecommendations(req, res) {
        try {
            const { siteId } = req.params;
            const siteCheck = await query(
                'SELECT id FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, req.user.id]
            );

            if (siteCheck.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            const result = await performanceService.analyzePerformance(siteId);
            if (!result.success) return res.status(404).json(result);

            res.json({
                success: true,
                data: {
                    recommendations: result.data.recommendations,
                    performance_score: result.data.performance_score
                }
            });
        } catch (error) {
            console.error('Error in getRecommendations:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getStatistics(req, res) {
        try {
            const { siteId } = req.params;
            const days = parseInt(req.query.days) || 30;
            const siteCheck = await query(
                'SELECT id FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, req.user.id]
            );

            if (siteCheck.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            const result = await performanceService.getStatistics(siteId, days);
            res.json(result);
        } catch (error) {
            console.error('Error in getStatistics:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async saveMetrics(req, res) {
        try {
            const { siteId } = req.params;
            const metrics = req.body;
            const siteCheck = await query('SELECT id, user_id FROM sites WHERE id = $1', [siteId]);

            if (siteCheck.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            const result = await performanceService.saveMetrics(siteId, metrics);
            
            if (result.success && req.io) {
                const site = siteCheck.rows[0];
                req.io.to(`user_${site.user_id}`).emit('performance_update', {
                    siteId: siteId,
                    metrics: result.data
                });
            }

            res.json(result);
        } catch (error) {
            console.error('Error in saveMetrics:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new PerformanceController();

