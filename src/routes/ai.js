const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');
const AIService = require('../services/aiService');

// AI Status (öffentlich - keine Auth nötig)
router.get('/status', async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                configured: AIService.isConfigured,
                provider: AIService.preferredModel,
                features: {
                    full_analysis: true,
                    proactive_detection: true,
                    auto_fix: true,
                    chat: AIService.isConfigured,
                    security_recommendations: true,
                    performance_analysis: true,
                    update_analysis: true
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// All other routes require authentication
router.use(authenticateToken);

// Hilfsfunktion für Site-Zugriffsprüfung
async function checkSiteAccess(siteId, userId) {
    const result = await query(
        'SELECT id FROM sites WHERE id = $1 AND user_id = $2',
        [siteId, userId]
    );
    return result.rows.length > 0;
}

// ==========================================
// AI ENDPOINTS
// ==========================================

// Gespeicherte AI Insights abrufen
router.get('/:siteId/insights', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;
        
        if (!await checkSiteAccess(siteId, userId)) {
            return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
        }
        
        const result = await AIService.getAIInsights(siteId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Vollständige KI-Analyse durchführen
router.post('/:siteId/analyze', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;
        
        if (!await checkSiteAccess(siteId, userId)) {
            return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
        }
        
        const result = await AIService.performFullSiteAnalysis(siteId);
        res.json(result);
    } catch (error) {
        console.error('AI Analyze error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Proaktive Problemerkennung
router.get('/:siteId/proactive', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;
        
        if (!await checkSiteAccess(siteId, userId)) {
            return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
        }
        
        const result = await AIService.detectProactiveIssues(siteId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update-Sicherheitsanalyse
router.post('/:siteId/analyze-updates', async (req, res) => {
    try {
        const { siteId } = req.params;
        const { updateType, updates } = req.body;
        const userId = req.user?.userId || req.user?.id;
        
        if (!await checkSiteAccess(siteId, userId)) {
            return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
        }
        
        const result = await AIService.analyzeUpdateSafety(siteId, updateType, updates);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Auto-Fix generieren
router.post('/:siteId/auto-fix', async (req, res) => {
    try {
        const { siteId } = req.params;
        const { problem } = req.body;
        const userId = req.user?.userId || req.user?.id;
        
        if (!await checkSiteAccess(siteId, userId)) {
            return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
        }
        
        const result = await AIService.generateAutoFix(siteId, problem);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// KI-Chat
router.post('/:siteId/chat', async (req, res) => {
    try {
        const { siteId } = req.params;
        const { message, history } = req.body;
        const userId = req.user?.userId || req.user?.id;
        
        if (!await checkSiteAccess(siteId, userId)) {
            return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
        }
        
        if (!message) {
            return res.status(400).json({ success: false, error: 'Nachricht ist erforderlich' });
        }
        
        const result = await AIService.chat(siteId, message, history || []);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Security-Empfehlungen
router.post('/:siteId/security-recommendations', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;
        
        if (!await checkSiteAccess(siteId, userId)) {
            return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
        }
        
        const siteData = await AIService.collectSiteData(siteId);
        if (!siteData.success) {
            return res.status(404).json(siteData);
        }
        
        const result = await AIService.generateSecurityRecommendations(siteData.data);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Performance-Analyse
router.post('/:siteId/performance-analysis', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;
        
        if (!await checkSiteAccess(siteId, userId)) {
            return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
        }
        
        const siteData = await AIService.collectSiteData(siteId);
        if (!siteData.success) {
            return res.status(404).json(siteData);
        }
        
        const result = await AIService.analyzePerformanceMetrics({
            site_id: siteId,
            ...siteData.data.performance
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;