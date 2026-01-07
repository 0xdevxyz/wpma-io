/**
 * Incremental Backup Routes
 * API-Endpunkte für inkrementelle und Real-Time Backups
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const IncrementalBackupService = require('../services/incrementalBackupService');

router.use(authenticateToken);

/**
 * POST /api/v1/incremental-backup/:siteId
 * Erstellt ein inkrementelles Backup
 */
router.post('/:siteId', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;

        const result = await IncrementalBackupService.createIncrementalBackup(
            parseInt(siteId), 
            userId
        );
        res.json(result);
    } catch (error) {
        console.error('Create incremental backup error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/v1/incremental-backup/:siteId/full
 * Erstellt ein Full-Backup (Basis für inkrementelle)
 */
router.post('/:siteId/full', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;

        // Hole Site-Info
        const { query } = require('../config/database');
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
});

/**
 * GET /api/v1/incremental-backup/:siteId/history
 * Holt die Backup-Historie
 */
router.get('/:siteId/history', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;
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
});

/**
 * POST /api/v1/incremental-backup/:siteId/restore
 * Point-in-Time Wiederherstellung
 */
router.post('/:siteId/restore', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;
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
});

// ==========================================
// REAL-TIME BACKUP ENDPOINTS
// ==========================================

/**
 * POST /api/v1/incremental-backup/:siteId/realtime/enable
 * Aktiviert Real-Time Backup
 */
router.post('/:siteId/realtime/enable', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;
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
});

/**
 * POST /api/v1/incremental-backup/:siteId/realtime/disable
 * Deaktiviert Real-Time Backup
 */
router.post('/:siteId/realtime/disable', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;

        const result = await IncrementalBackupService.disableRealTimeBackup(
            parseInt(siteId), 
            userId
        );
        res.json(result);
    } catch (error) {
        console.error('Disable real-time backup error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/incremental-backup/:siteId/realtime/status
 * Holt Real-Time Backup Status
 */
router.get('/:siteId/realtime/status', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;

        const result = await IncrementalBackupService.getRealTimeBackupStatus(
            parseInt(siteId), 
            userId
        );
        res.json(result);
    } catch (error) {
        console.error('Get real-time backup status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

