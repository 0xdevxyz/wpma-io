const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const securityController = require('../controllers/securityController');

// Public endpoint for WordPress Plugin
router.post('/:siteId/scan', securityController.startScan);

// Authenticated routes
router.use(authenticateToken);

router.get('/:siteId/status', securityController.getStatus);
router.get('/:siteId/vulnerabilities', securityController.getVulnerabilities);
router.get('/:siteId/history', securityController.getHistory);
router.get('/:siteId/statistics', securityController.getStatistics);

module.exports = router; 