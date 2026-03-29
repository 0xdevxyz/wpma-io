const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const aiController = require('../controllers/aiController');

router.get('/status', aiController.getStatus.bind(aiController));

router.use(authenticateToken);

router.get('/:siteId/insights', aiController.getInsights.bind(aiController));
router.post('/:siteId/analyze', aiController.analyze.bind(aiController));
router.get('/:siteId/proactive', aiController.getProactive.bind(aiController));
router.post('/:siteId/analyze-updates', aiController.analyzeUpdates.bind(aiController));
router.post('/:siteId/auto-fix', aiController.autoFix.bind(aiController));
router.post('/:siteId/chat', aiController.chat.bind(aiController));
router.post('/:siteId/security-recommendations', aiController.securityRecommendations.bind(aiController));
router.post('/:siteId/performance-analysis', aiController.performanceAnalysis.bind(aiController));
router.post('/:siteId/risk-analysis', aiController.riskAnalysis.bind(aiController));

module.exports = router;
