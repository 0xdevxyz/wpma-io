const { query } = require('../config/database');
const { logger } = require('../utils/logger');

class RollbackController {
    async notify(req, res) {
        try {
            const { site_id, snapshot_id, issues, rollback_type } = req.body;

            if (!site_id) {
                return res.status(400).json({ success: false, error: 'site_id ist erforderlich' });
            }

            await query(
                `INSERT INTO rollback_events (site_id, snapshot_id, issues, rollback_type, created_at)
                 VALUES ($1, $2, $3, $4, NOW())
                 ON CONFLICT DO NOTHING`,
                [site_id, snapshot_id || null, JSON.stringify(issues || []), rollback_type || 'automatic']
            );

            logger.info('Rollback notification received', { site_id, snapshot_id, rollback_type });

            res.json({ success: true, message: 'Rollback-Benachrichtigung gespeichert' });
        } catch (error) {
            logger.error('Rollback notify error', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async healthAlert(req, res) {
        try {
            const { site_id, issues } = req.body;

            if (!site_id) {
                return res.status(400).json({ success: false, error: 'site_id ist erforderlich' });
            }

            await query(
                `INSERT INTO site_health_alerts (site_id, issues, created_at)
                 VALUES ($1, $2, NOW())`,
                [site_id, JSON.stringify(issues || [])]
            );

            logger.warn('Site health alert received', { site_id, issueCount: (issues || []).length });

            res.json({ success: true, message: 'Health-Alert gespeichert' });
        } catch (error) {
            logger.error('Health alert error', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new RollbackController();
