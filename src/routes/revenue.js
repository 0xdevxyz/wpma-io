'use strict';

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const revenueController = require('../controllers/revenueController');

router.post('/:siteId/snapshot', revenueController.saveSnapshot.bind(revenueController));
router.post('/:siteId/event', revenueController.recordEvent.bind(revenueController));
router.get('/:siteId/summary', authenticateToken, revenueController.getSummary.bind(revenueController));
router.get('/:siteId/correlations', authenticateToken, revenueController.getCorrelations.bind(revenueController));
router.get('/:siteId/impact', authenticateToken, revenueController.getRevenueImpact.bind(revenueController));
router.post('/:siteId/correlations/:corrId/resolve', authenticateToken, revenueController.resolveCorrelation.bind(revenueController));
router.post('/:siteId/analyze', authenticateToken, revenueController.analyzeCorrelations.bind(revenueController));

module.exports = router;
