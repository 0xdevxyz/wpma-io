const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const vulnerabilityController = require('../controllers/vulnerabilityController');

router.use(authenticateToken);

router.get('/alerts', vulnerabilityController.getAlerts);
router.get('/alerts/:alertId', vulnerabilityController.getAlertDetails);
router.post('/alerts/:alertId/dismiss', vulnerabilityController.dismissAlert);
router.post('/alerts/:alertId/resolve', vulnerabilityController.resolveAlert);
router.post('/scan', vulnerabilityController.triggerScan);
router.get('/statistics', vulnerabilityController.getStatistics);

module.exports = router;
