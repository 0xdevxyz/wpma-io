const NotificationService = require('../services/notificationService');
const { query } = require('../config/database');

class NotificationsController {
    async getSettings(req, res) {
        try {
            const userId = req.user?.userId;
            const settings = await NotificationService.getUserNotificationSettings(userId);

            res.json({
                success: true,
                data: settings || {
                    channels: {},
                    enabledEvents: []
                }
            });
        } catch (error) {
            console.error('Get notification settings error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async saveSettings(req, res) {
        try {
            const userId = req.user?.userId;
            const settings = req.body;

            const result = await NotificationService.saveNotificationSettings(userId, settings);
            res.json(result);
        } catch (error) {
            console.error('Save notification settings error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getEventTypes(req, res) {
        res.json({
            success: true,
            data: NotificationService.getAvailableEventTypes()
        });
    }

    async testChannel(req, res) {
        try {
            const { channelType, config } = req.body;

            if (!channelType || !config) {
                return res.status(400).json({
                    success: false,
                    error: 'channelType und config erforderlich'
                });
            }

            const result = await NotificationService.testChannel(channelType, config);
            res.json(result);
        } catch (error) {
            console.error('Test notification error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getHistory(req, res) {
        try {
            const userId = req.user?.userId;
            const limit = parseInt(req.query.limit) || 50;

            const result = await NotificationService.getNotificationHistory(userId, limit);
            res.json(result);
        } catch (error) {
            console.error('Get notification history error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async sendTest(req, res) {
        try {
            const userId = req.user?.userId;

            const result = await NotificationService.notify(userId, 'test', {
                domain: 'test.example.com',
                message: 'Dies ist eine Test-Benachrichtigung'
            });

            res.json(result);
        } catch (error) {
            console.error('Send test notification error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async zapierWebhook(req, res) {
        try {
            const { action, siteId, data } = req.body;

            console.log('Zapier webhook received:', { action, siteId });

            res.json({ success: true, message: 'Webhook empfangen' });
        } catch (error) {
            console.error('Zapier webhook error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async zapierSubscribe(req, res) {
        try {
            const userId = req.user?.userId;
            const { hookUrl, event } = req.body;

            await query(
                `INSERT INTO zapier_subscriptions (user_id, hook_url, event_type)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (user_id, event_type)
                 DO UPDATE SET hook_url = $2, updated_at = CURRENT_TIMESTAMP
                 RETURNING id`,
                [userId, hookUrl, event]
            );

            res.json({ success: true, message: 'Subscription created' });
        } catch (error) {
            console.error('Zapier subscribe error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async zapierUnsubscribe(req, res) {
        try {
            const userId = req.user?.userId;
            const { event } = req.body;

            await query(
                `DELETE FROM zapier_subscriptions WHERE user_id = $1 AND event_type = $2`,
                [userId, event]
            );

            res.json({ success: true, message: 'Subscription removed' });
        } catch (error) {
            console.error('Zapier unsubscribe error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new NotificationsController();
