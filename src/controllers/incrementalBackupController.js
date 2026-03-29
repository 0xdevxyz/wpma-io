const IncrementalBackupService = require('../services/incrementalBackupService');
const { query } = require('../config/database');

class IncrementalBackupController {
    async createIncrementalBackup(req, res) {
        try {
            const { siteId } = req.params;
            const userId = req.user?.userId;

            const result = await IncrementalBackupService.createIncrementalBackup(
                parseInt(siteId),
                userId
            );
            res.json(result);
        } catch (error) {
            console.error('Create incremental backup error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async createFullBackup(req, res) {
        try {
            const { siteId } = req.params;
            const userId = req.user?.userId;

            const siteResult = await query(
                'SELECT * FROM sites WHERE id = $1 AND user_id = $2',
                [parseInt(siteId), userId]
            );

            if (siteResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            const result = await IncrementalBackupService.createFullBackup(
                parseInt(siteId),
                siteResult.rows[0]
            );
            res.json(result);
        } catch (error) {
            console.error('Create full backup error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getBackupHistory(req, res) {
        try {
            const { siteId } = req.params;
            const userId = req.user?.userId;
            const { limit, type } = req.query;

            const result = await IncrementalBackupService.getBackupHistory(
                parseInt(siteId),
                userId,
                { limit: parseInt(limit) || 50, type }
            );
            res.json(result);
        } catch (error) {
            console.error('Get backup history error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async restoreToPointInTime(req, res) {
        try {
            const { siteId } = req.params;
            const userId = req.user?.userId;
            const { targetTimestamp } = req.body;

            if (!targetTimestamp) {
                return res.status(400).json({
                    success: false,
                    error: 'Ziel-Zeitpunkt erforderlich'
                });
            }

            const result = await IncrementalBackupService.restoreToPointInTime(
                parseInt(siteId),
                userId,
                new Date(targetTimestamp)
            );
            res.json(result);
        } catch (error) {
            console.error('Restore to point in time error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async enableRealTimeBackup(req, res) {
        try {
            const { siteId } = req.params;
            const userId = req.user?.userId;
            const options = req.body;

            const result = await IncrementalBackupService.enableRealTimeBackup(
                parseInt(siteId),
                userId,
                options
            );
            res.json(result);
        } catch (error) {
            console.error('Enable real-time backup error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async disableRealTimeBackup(req, res) {
        try {
            const { siteId } = req.params;
            const userId = req.user?.userId;

            const result = await IncrementalBackupService.disableRealTimeBackup(
                parseInt(siteId),
                userId
            );
            res.json(result);
        } catch (error) {
            console.error('Disable real-time backup error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getRealTimeBackupStatus(req, res) {
        try {
            const { siteId } = req.params;
            const userId = req.user?.userId;

            const result = await IncrementalBackupService.getRealTimeBackupStatus(
                parseInt(siteId),
                userId
            );
            res.json(result);
        } catch (error) {
            console.error('Get real-time backup status error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new IncrementalBackupController();
