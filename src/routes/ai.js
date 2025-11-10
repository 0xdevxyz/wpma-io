const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const AIService = require('../services/aiService');

// All routes require authentication
router.use(authenticateToken);

// AI endpoints
router.get('/:siteId/insights', async (req, res) => {
    try {
        const { siteId } = req.params;
        const result = await AIService.getAIInsights(siteId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;