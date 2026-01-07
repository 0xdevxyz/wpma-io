/**
 * Notifications Routes
 * API-Endpunkte für Benachrichtigungseinstellungen
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const NotificationService = require('../services/notificationService');

router.use(authenticateToken);

/**
 * GET /api/v1/notifications/settings
 * Holt die Benachrichtigungseinstellungen
 */
router.get('/settings', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
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
});

/**
 * POST /api/v1/notifications/settings
 * Speichert die Benachrichtigungseinstellungen
 */
router.post('/settings', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const settings = req.body;

        const result = await NotificationService.saveNotificationSettings(userId, settings);
        res.json(result);
    } catch (error) {
        console.error('Save notification settings error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/notifications/event-types
 * Holt verfügbare Event-Typen
 */
router.get('/event-types', async (req, res) => {
    res.json({
        success: true,
        data: NotificationService.getAvailableEventTypes()
    });
});

/**
 * POST /api/v1/notifications/test
 * Testet einen Notification-Kanal
 */
router.post('/test', async (req, res) => {
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
});

/**
 * GET /api/v1/notifications/history
 * Holt die Benachrichtigungshistorie
 */
router.get('/history', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const limit = parseInt(req.query.limit) || 50;

        const result = await NotificationService.getNotificationHistory(userId, limit);
        res.json(result);
    } catch (error) {
        console.error('Get notification history error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/v1/notifications/send-test
 * Sendet eine Test-Benachrichtigung
 */
router.post('/send-test', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;

        const result = await NotificationService.notify(userId, 'test', {
            domain: 'test.example.com',
            message: 'Dies ist eine Test-Benachrichtigung'
        });

        res.json(result);
    } catch (error) {
        console.error('Send test notification error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// WEBHOOK ENDPOINTS (für externe Integrationen)
// ==========================================

/**
 * POST /api/v1/notifications/webhook/zapier
 * Eingehender Webhook von Zapier
 */
router.post('/webhook/zapier', async (req, res) => {
    try {
        // Zapier kann Aktionen triggern
        const { action, siteId, data } = req.body;

        console.log('Zapier webhook received:', { action, siteId });

        // TODO: Implementiere Zapier-Aktionen
        // z.B. Backup triggern, Security Scan starten, etc.

        res.json({ success: true, message: 'Webhook empfangen' });
    } catch (error) {
        console.error('Zapier webhook error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/notifications/webhook/zapier/subscribe
 * Zapier Subscription Endpoint
 */
router.post('/webhook/zapier/subscribe', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const { hookUrl, event } = req.body;

        // Speichere Zapier Hook URL
        const { query } = require('../config/database');
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
});

/**
 * DELETE /api/v1/notifications/webhook/zapier/subscribe
 * Zapier Unsubscribe Endpoint
 */
router.delete('/webhook/zapier/subscribe', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const { event } = req.body;

        const { query } = require('../config/database');
        await query(
            `DELETE FROM zapier_subscriptions WHERE user_id = $1 AND event_type = $2`,
            [userId, event]
        );

        res.json({ success: true, message: 'Subscription removed' });
    } catch (error) {
        console.error('Zapier unsubscribe error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

