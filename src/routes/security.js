const express = require('express');
const router = express.Router();
const { authenticateToken, authenticateWordPressAPI, wpApiRateLimiter } = require('../middleware/auth');
const securityController = require('../controllers/securityController');

// WordPress Plugin endpoint — rate-limited + requires valid API key
router.post('/:siteId/scan', wpApiRateLimiter, authenticateWordPressAPI, securityController.startScan);

// Dashboard authenticated routes
router.use(authenticateToken);

router.get('/:siteId/status', securityController.getStatus);
router.get('/:siteId/vulnerabilities', securityController.getVulnerabilities);
router.get('/:siteId/history', securityController.getHistory);
router.get('/:siteId/statistics', securityController.getStatistics);

module.exports = router; 