const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const chatController = require('../controllers/chatController');

router.use(authenticateToken);

router.post('/', chatController.universalChat.bind(chatController));

router.post('/:siteId/message', chatController.sendMessage.bind(chatController));

router.get('/conversations', chatController.getConversations.bind(chatController));

router.get('/conversations/:conversationId/history', chatController.getConversationHistory.bind(chatController));

router.delete('/conversations/:conversationId', chatController.deleteConversation.bind(chatController));

router.post('/:siteId/quick-action', chatController.quickAction.bind(chatController));

router.get('/:siteId/predictions', chatController.getPredictions.bind(chatController));

router.post('/:siteId/analyze', chatController.analyzeAll.bind(chatController));

router.get('/:siteId/health-summary', chatController.getHealthSummary.bind(chatController));

router.post('/:siteId/auto-fix', chatController.autoFix.bind(chatController));

module.exports = router;
