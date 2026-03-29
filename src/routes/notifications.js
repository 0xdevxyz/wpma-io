const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const notificationsController = require('../controllers/notificationsController');

router.use(authenticateToken);

router.get('/settings', notificationsController.getSettings.bind(notificationsController));
router.post('/settings', notificationsController.saveSettings.bind(notificationsController));
router.get('/event-types', notificationsController.getEventTypes.bind(notificationsController));
router.post('/test', notificationsController.testChannel.bind(notificationsController));
router.get('/history', notificationsController.getHistory.bind(notificationsController));
router.post('/send-test', notificationsController.sendTest.bind(notificationsController));
router.post('/webhook/zapier', notificationsController.zapierWebhook.bind(notificationsController));
router.post('/webhook/zapier/subscribe', notificationsController.zapierSubscribe.bind(notificationsController));
router.delete('/webhook/zapier/subscribe', notificationsController.zapierUnsubscribe.bind(notificationsController));

module.exports = router;
