const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const syncController = require('../controllers/syncController');

router.use(authenticateToken);

router.post('/sites/:siteId/sync', (req, res) => syncController.syncSite(req, res));
router.post('/sync-all', (req, res) => syncController.syncAll(req, res));
router.get('/sites/:siteId/synced-data', (req, res) => syncController.getSyncedData(req, res));

module.exports = router;
