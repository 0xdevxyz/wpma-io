const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const BackupService = require('../services/backupService');

// All routes require authentication
router.use(authenticateToken);

// Backup endpoints
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
        const result = await BackupService.createBackup(siteId, backupType, provider);
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

module.exports = router;