const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const paymentService = require('../services/paymentService');
const { authenticateToken } = require('../middleware/auth');

// POST /api/v1/payment/webhook
// Raw body wird in index.js per express.raw() gesetzt — kein JSON-Parser davor
router.post('/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;
    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const handled = [
        'checkout.session.completed',
        'customer.subscription.updated',
        'customer.subscription.deleted',
    ];

    if (handled.includes(event.type)) {
        const result = await paymentService.handleWebhook(event);
        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }
    }

    res.json({ received: true });
});

// POST /api/v1/payment/subscribe
router.post('/subscribe', authenticateToken, async (req, res) => {
    try {
        const { planType } = req.body;
        const result = await paymentService.createSubscription(req.user.id, planType);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/payment/cancel
router.post('/cancel', authenticateToken, async (req, res) => {
    try {
        const result = await paymentService.cancelSubscription(req.user.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/v1/payment/update
router.put('/update', authenticateToken, async (req, res) => {
    try {
        const { planType } = req.body;
        const result = await paymentService.updateSubscription(req.user.id, planType);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/payment/status
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const result = await paymentService.getSubscriptionStatus(req.user.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
