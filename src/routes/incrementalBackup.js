const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const incrementalBackupController = require('../controllers/incrementalBackupController');

router.use(authenticateToken);

router.post('/:siteId', incrementalBackupController.createIncrementalBackup.bind(incrementalBackupController));
router.post('/:siteId/full', incrementalBackupController.createFullBackup.bind(incrementalBackupController));
router.get('/:siteId/history', incrementalBackupController.getBackupHistory.bind(incrementalBackupController));
router.post('/:siteId/restore', incrementalBackupController.restoreToPointInTime.bind(incrementalBackupController));
router.post('/:siteId/realtime/enable', incrementalBackupController.enableRealTimeBackup.bind(incrementalBackupController));
router.post('/:siteId/realtime/disable', incrementalBackupController.disableRealTimeBackup.bind(incrementalBackupController));
router.get('/:siteId/realtime/status', incrementalBackupController.getRealTimeBackupStatus.bind(incrementalBackupController));

module.exports = router;
