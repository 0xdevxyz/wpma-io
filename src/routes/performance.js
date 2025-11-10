const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const performanceController = require('../controllers/performanceController');

// Public endpoint for WordPress Plugin
router.post('/:siteId/metrics', performanceController.saveMetrics);

// Authenticated routes
router.use(authenticateToken);

router.get('/:siteId/metrics', performanceController.getMetrics);
router.get('/:siteId/history', performanceController.getHistory);
router.post('/:siteId/analyze', performanceController.analyze);
router.get('/:siteId/recommendations', performanceController.getRecommendations);
router.get('/:siteId/statistics', performanceController.getStatistics);

module.exports = router; 