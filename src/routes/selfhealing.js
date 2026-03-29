const express = require('express');
const router = express.Router();
const { authenticateToken: auth, authenticateWordPressAPI } = require('../middleware/auth');
const selfHealingController = require('../controllers/selfhealingController');

router.post('/analyze', auth, selfHealingController.analyzeProblem.bind(selfHealingController));
router.post('/apply', auth, selfHealingController.applyFix.bind(selfHealingController));
router.post('/auto', authenticateWordPressAPI, selfHealingController.autoHeal.bind(selfHealingController));
router.get('/history/:siteId', auth, selfHealingController.getHealingHistory.bind(selfHealingController));

module.exports = router;
