const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const BackupService = require('../services/backupService');

const getUserId = (req) => req.user?.userId || req.user?.id;

// All routes require authentication
router.use(authenticateToken);

// ── Quota ─────────────────────────────────────────────────────────────────

router.get('/quota', async (req, res) => {
    try {
        const userId = getUserId(req);
        const result = await BackupService.getQuota(userId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/quota/upgrade', async (req, res) => {
    try {
        const userId = getUserId(req);
        const result = await BackupService.upgradeQuota(userId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── Schedules ─────────────────────────────────────────────────────────────

router.get('/:siteId/schedule', async (req, res) => {
    try {
        const { siteId } = req.params;
        const result = await BackupService.getSchedule(siteId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/:siteId/schedule', async (req, res) => {
    try {
        const { siteId } = req.params;
        const { scheduleType, backupType, hour, dayOfWeek, dayOfMonth } = req.body;
        if (!scheduleType) return res.status(400).json({ success: false, error: 'scheduleType erforderlich' });
        const result = await BackupService.setSchedule(siteId, { scheduleType, backupType, hour, dayOfWeek, dayOfMonth });
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── Backup CRUD ───────────────────────────────────────────────────────────

router.get('/:siteId', async (req, res) => {
    try {
        const { siteId } = req.params;
        const result = await BackupService.getBackups(siteId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/:siteId', async (req, res) => {
    try {
        const { siteId } = req.params;
        const { backupType, provider } = req.body;
        const userId = getUserId(req);
        const result = await BackupService.createBackup(siteId, backupType, provider, userId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/:backupId/restore', async (req, res) => {
    try {
        const { backupId } = req.params;
        const { targetSiteId } = req.body;
        if (!targetSiteId) return res.status(400).json({ success: false, error: 'targetSiteId erforderlich' });
        const result = await BackupService.restoreBackup(backupId, targetSiteId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/:backupId/restore', async (req, res) => {
    try {
        const { backupId } = req.params;
        const { targetSiteId } = req.body;
        const result = await BackupService.restoreBackup(backupId, targetSiteId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/:backupId', async (req, res) => {
    try {
        const { backupId } = req.params;
        const result = await BackupService.deleteBackup(backupId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/:backupId/download', async (req, res) => {
    try {
        const { backupId } = req.params;
        const result = await BackupService.getDownloadUrl(backupId);
        if (!result.success) return res.status(404).json(result);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;