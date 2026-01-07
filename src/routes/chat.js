/**
 * AI Chat Routes
 * API-Endpunkte für den KI-Chat-Assistenten
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const AIChatService = require('../services/aiChatService');
const PredictiveService = require('../services/predictiveService');

router.use(authenticateToken);

// ==========================================
// CHAT ENDPOINTS
// ==========================================

/**
 * POST /api/v1/chat/:siteId/message
 * Sendet eine Nachricht an den KI-Assistenten
 */
router.post('/:siteId/message', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;
        const { message, conversationId } = req.body;

        if (!message || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Nachricht erforderlich'
            });
        }

        const result = await AIChatService.chat(userId, parseInt(siteId), message, conversationId);
        res.json(result);
    } catch (error) {
        console.error('Chat message error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/chat/conversations
 * Holt alle Konversationen des Users
 */
router.get('/conversations', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const limit = parseInt(req.query.limit) || 20;

        const result = await AIChatService.getUserConversations(userId, limit);
        res.json(result);
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/chat/conversations/:conversationId/history
 * Holt die Historie einer Konversation
 */
router.get('/conversations/:conversationId/history', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const history = await AIChatService.getConversationHistory(parseInt(conversationId));
        res.json({ success: true, data: history });
    } catch (error) {
        console.error('Get conversation history error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/v1/chat/conversations/:conversationId
 * Löscht eine Konversation
 */
router.delete('/conversations/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user?.userId || req.user?.id;

        const result = await AIChatService.deleteConversation(userId, parseInt(conversationId));
        res.json(result);
    } catch (error) {
        console.error('Delete conversation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/v1/chat/:siteId/quick-action
 * Führt eine Quick-Action aus dem Chat aus
 */
router.post('/:siteId/quick-action', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;
        const { action, params } = req.body;

        if (!action) {
            return res.status(400).json({
                success: false,
                error: 'Aktion erforderlich'
            });
        }

        const result = await AIChatService.executeAction(userId, parseInt(siteId), action, params || {});
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Quick action error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// PREDICTIVE MAINTENANCE ENDPOINTS
// ==========================================

/**
 * GET /api/v1/chat/:siteId/predictions
 * Holt die neuesten Vorhersagen für eine Site
 */
router.get('/:siteId/predictions', async (req, res) => {
    try {
        const { siteId } = req.params;
        const result = await PredictiveService.getLatestPredictions(parseInt(siteId));
        res.json(result);
    } catch (error) {
        console.error('Get predictions error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/v1/chat/:siteId/analyze
 * Führt eine vollständige Predictive Analyse durch
 */
router.post('/:siteId/analyze', async (req, res) => {
    try {
        const { siteId } = req.params;
        const result = await PredictiveService.analyzeAll(parseInt(siteId));
        res.json(result);
    } catch (error) {
        console.error('Analyze error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/chat/:siteId/health-summary
 * Holt eine KI-generierte Zusammenfassung der Site-Gesundheit
 */
router.get('/:siteId/health-summary', async (req, res) => {
    try {
        const { siteId } = req.params;
        const aiService = require('../services/aiService');
        
        const analysis = await aiService.performFullSiteAnalysis(parseInt(siteId));
        res.json(analysis);
    } catch (error) {
        console.error('Health summary error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/v1/chat/:siteId/auto-fix
 * Generiert automatische Lösungsvorschläge für ein Problem
 */
router.post('/:siteId/auto-fix', async (req, res) => {
    try {
        const { siteId } = req.params;
        const { problem } = req.body;

        if (!problem) {
            return res.status(400).json({
                success: false,
                error: 'Problem-Beschreibung erforderlich'
            });
        }

        const aiService = require('../services/aiService');
        const result = await aiService.generateAutoFix(parseInt(siteId), problem);
        res.json(result);
    } catch (error) {
        console.error('Auto-fix error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

