const express = require('express');
const router = express.Router();
const monitoringController = require('../controllers/monitoringController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/:siteId/uptime', monitoringController.getUptime.bind(monitoringController));
router.get('/:siteId/incidents', monitoringController.getIncidents.bind(monitoringController));
router.post('/:siteId/check', monitoringController.checkUptime.bind(monitoringController));

module.exports = router;
