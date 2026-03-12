const express = require('express');
const router = express.Router();
const { authenticateToken: auth } = require('../middleware/auth');
const { query } = require('../config/database');
const wpSyncService = require('../services/wpSyncService');

router.post('/sites/:siteId/sync',
    auth,
    async (req, res) => {
        try {
            const { siteId } = req.params;

            // Verify ownership
            const siteResult = await query(
                'SELECT id FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, req.user.userId]
            );
            if (siteResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            const result = await wpSyncService.syncSite(siteId);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json(result);

        } catch (error) {
            console.error('Sync endpoint error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

router.post('/sync-all',
    auth,
    async (req, res) => {
        try {
            const result = await wpSyncService.syncUserSites
                ? await wpSyncService.syncUserSites(req.user.userId)
                : await wpSyncService.syncAllSites();

            res.json(result);

        } catch (error) {
            console.error('Sync all endpoint error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

router.get('/sites/:siteId/synced-data',
    auth,
    async (req, res) => {
        try {
            const { siteId } = req.params;

            // Verify ownership
            const siteResult = await query(
                'SELECT id FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, req.user.userId]
            );
            if (siteResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            const result = await wpSyncService.getSyncedData(siteId);

            if (!result.success) {
                return res.status(404).json(result);
            }

            res.json(result);

        } catch (error) {
            console.error('Get synced data error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

module.exports = router;
