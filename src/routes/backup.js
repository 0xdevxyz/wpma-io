const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const backupController = require('../controllers/backupController');

router.use(authenticateToken);

router.get('/quota', backupController.getQuota.bind(backupController));
router.post('/quota/upgrade', backupController.upgradeQuota.bind(backupController));
router.get('/:siteId/schedule', backupController.getSchedule.bind(backupController));
router.post('/:siteId/schedule', backupController.setSchedule.bind(backupController));
router.get('/:siteId', backupController.getBackups.bind(backupController));
router.post('/:siteId', backupController.createBackup.bind(backupController));
router.post('/:backupId/restore', backupController.restoreBackup.bind(backupController));
router.delete('/:backupId', backupController.deleteBackup.bind(backupController));
router.get('/:backupId/download', backupController.getDownloadUrl.bind(backupController));

module.exports = router;
