const express = require('express');
const router = express.Router();
const { authenticateToken: auth } = require('../middleware/auth');
const aiRecommendationsService = require('../services/aiRecommendationsService');
const predictiveService = require('../services/predictiveService');

router.get('/recommendations/site/:siteId',
    auth,
    async (req, res) => {
        try {
            const { siteId } = req.params;
            
            const result = await aiRecommendationsService.generateSiteRecommendations(siteId);
            
            res.json(result);

        } catch (error) {
            console.error('Get site recommendations error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

router.get('/recommendations/dashboard',
    auth,
    async (req, res) => {
        try {
            const result = await aiRecommendationsService.generateDashboardInsights(req.user.userId);
            
            res.json(result);

        } catch (error) {
            console.error('Get dashboard insights error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

router.get('/predictive/conflicts/:siteId',
    auth,
    async (req, res) => {
        try {
            const { siteId } = req.params;
            
            const result = await predictiveService.predictPluginConflicts(siteId);
            
            res.json(result);

        } catch (error) {
            console.error('Predict conflicts error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

router.get('/predictive/update-risk/:siteId/:pluginSlug',
    auth,
    async (req, res) => {
        try {
            const { siteId, pluginSlug } = req.params;
            
            const result = await predictiveService.predictUpdateIssues(siteId, pluginSlug);
            
            res.json(result);

        } catch (error) {
            console.error('Predict update risk error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

router.get('/predictive/update-patterns',
    auth,
    async (req, res) => {
        try {
            const result = await predictiveService.analyzeUpdatePatterns(req.user.userId);
            
            res.json(result);

        } catch (error) {
            console.error('Analyze update patterns error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

// POST route for generating recommendations (called by frontend aiApi.generateRecommendations)
router.post('/:siteId/recommendations',
    auth,
    async (req, res) => {
        try {
            const { siteId } = req.params;
            const result = await aiRecommendationsService.generateSiteRecommendations(siteId);
            res.json(result);
        } catch (error) {
            console.error('Generate recommendations error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

router.get('/:siteId/insights',
    auth,
    async (req, res) => {
        try {
            const { siteId } = req.params;
            
            const result = await aiRecommendationsService.generateSiteRecommendations(siteId);
            
            res.json(result);

        } catch (error) {
            console.error('Get AI insights error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

module.exports = router;
