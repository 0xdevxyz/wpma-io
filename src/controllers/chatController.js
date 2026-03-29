const AIChatService = require('../services/aiChatService');
const PredictiveService = require('../services/predictiveService');

class ChatController {
    async universalChat(req, res) {
        try {
            const userId = req.user?.userId;
            const { message, conversationHistory, siteId, conversationId } = req.body;

            if (!message || message.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Nachricht erforderlich'
                });
            }

            let result;
            if (siteId) {
                result = await AIChatService.chat(userId, parseInt(siteId), message, conversationId);
            } else {
                const aiService = require('../services/aiService');
                const aiResult = await aiService.chatWithAssistant({
                    userId,
                    siteId: null,
                    message,
                    conversationHistory: conversationHistory || []
                });
                result = {
                    success: aiResult.success !== false,
                    data: {
                        message: aiResult.response || 'Ich habe deine Anfrage verarbeitet.',
                        suggestions: aiResult.suggestions || [],
                        actions: []
                    }
                };
            }

            if (result.success) {
                const defaultSuggestions = [
                    'Zeige mir alle Sites mit Problemen',
                    'Welche Updates sind verfügbar?',
                    'Erstelle ein Backup',
                    'Überprüfe die Sicherheit'
                ];

                res.json({
                    success: true,
                    data: {
                        message: result.data?.message || result.data?.response || 'Ich habe deine Anfrage verarbeitet.',
                        suggestions: result.data?.suggestions || defaultSuggestions,
                        actions: result.data?.actions || [],
                        conversationId: result.data?.conversationId
                    }
                });
            } else {
                res.status(500).json(result);
            }
        } catch (error) {
            console.error('Universal chat error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async sendMessage(req, res) {
        try {
            const { siteId } = req.params;
            const userId = req.user?.userId;
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
    }

    async getConversations(req, res) {
        try {
            const userId = req.user?.userId;
            const limit = parseInt(req.query.limit) || 20;

            const result = await AIChatService.getUserConversations(userId, limit);
            res.json(result);
        } catch (error) {
            console.error('Get conversations error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getConversationHistory(req, res) {
        try {
            const { conversationId } = req.params;
            const history = await AIChatService.getConversationHistory(parseInt(conversationId));
            res.json({ success: true, data: history });
        } catch (error) {
            console.error('Get conversation history error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async deleteConversation(req, res) {
        try {
            const { conversationId } = req.params;
            const userId = req.user?.userId;

            const result = await AIChatService.deleteConversation(userId, parseInt(conversationId));
            res.json(result);
        } catch (error) {
            console.error('Delete conversation error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async quickAction(req, res) {
        try {
            const { siteId } = req.params;
            const userId = req.user?.userId;
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
    }

    async getPredictions(req, res) {
        try {
            const { siteId } = req.params;
            const result = await PredictiveService.getLatestPredictions(parseInt(siteId));
            res.json(result);
        } catch (error) {
            console.error('Get predictions error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async analyzeAll(req, res) {
        try {
            const { siteId } = req.params;
            const result = await PredictiveService.analyzeAll(parseInt(siteId));
            res.json(result);
        } catch (error) {
            console.error('Analyze error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getHealthSummary(req, res) {
        try {
            const { siteId } = req.params;
            const aiService = require('../services/aiService');

            const analysis = await aiService.performFullSiteAnalysis(parseInt(siteId));
            res.json(analysis);
        } catch (error) {
            console.error('Health summary error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async autoFix(req, res) {
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
    }
}

module.exports = new ChatController();
