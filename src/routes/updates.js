const express = require('express');
const router = express.Router();
const { authenticateToken, authenticateWordPressAPI } = require('../middleware/auth');
const updatesController = require('../controllers/updatesController');

router.post('/:siteId/available', authenticateWordPressAPI, updatesController.saveAvailableUpdates.bind(updatesController));

router.use(authenticateToken);

router.get('/:siteId/check', updatesController.checkForUpdates.bind(updatesController));
router.post('/:siteId/auto-update', updatesController.performAutoUpdate.bind(updatesController));
router.get('/:siteId/settings', updatesController.getAutoUpdateSettings.bind(updatesController));
router.put('/:siteId/settings', updatesController.setAutoUpdateSettings.bind(updatesController));
router.get('/:siteId/history', updatesController.getUpdateHistory.bind(updatesController));

module.exports = router;
