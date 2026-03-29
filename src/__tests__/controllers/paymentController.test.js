const request = require('supertest');
const express = require('express');

jest.mock('../../config/database', () => ({
    query: jest.fn()
}));

jest.mock('stripe', () => {
    const webhooksConstructEvent = jest.fn();
    const mockStripe = jest.fn(() => ({
        webhooks: { constructEvent: webhooksConstructEvent }
    }));
    mockStripe._webhooksConstructEvent = webhooksConstructEvent;
    return mockStripe;
});

jest.mock('../../middleware/auth', () => ({
    authenticateToken: (req, res, next) => {
        req.user = { id: 'test-user-id' };
        next();
    }
}));

jest.mock('../../services/paymentService', () => ({
    getSubscriptionStatus: jest.fn(),
    createSubscription: jest.fn(),
    cancelSubscription: jest.fn(),
    handleWebhook: jest.fn()
}));

const stripe = require('stripe');
const paymentService = require('../../services/paymentService');
const paymentController = require('../../controllers/paymentController');

function buildApp() {
    const app = express();
    app.use('/payment/webhook', express.raw({ type: 'application/json' }));
    app.use(express.json());
    const { authenticateToken } = require('../../middleware/auth');
    app.get('/payment/status', authenticateToken, paymentController.status.bind(paymentController));
    app.post('/payment/subscribe', authenticateToken, paymentController.subscribe.bind(paymentController));
    app.post('/payment/cancel', authenticateToken, paymentController.cancel.bind(paymentController));
    app.post('/payment/webhook', paymentController.webhook.bind(paymentController));
    return app;
}

describe('PaymentController', () => {
    let app;

    beforeAll(() => {
        app = buildApp();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /payment/status', () => {
        it('should return subscription status for authenticated user', async () => {
            paymentService.getSubscriptionStatus.mockResolvedValue({
                success: true,
                status: 'active',
                plan: 'pro',
                currentPeriodEnd: 1700000000,
                cancelAtPeriodEnd: false
            });

            const res = await request(app).get('/payment/status');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.status).toBe('active');
            expect(res.body.plan).toBe('pro');
            expect(paymentService.getSubscriptionStatus).toHaveBeenCalledWith('test-user-id');
        });

        it('should return 500 when service throws', async () => {
            paymentService.getSubscriptionStatus.mockRejectedValue(new Error('DB error'));

            const res = await request(app).get('/payment/status');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('DB error');
        });
    });

    describe('POST /payment/subscribe', () => {
        it('should create a subscription and return client secret', async () => {
            paymentService.createSubscription.mockResolvedValue({
                success: true,
                subscriptionId: 'sub_123',
                clientSecret: 'pi_secret_abc'
            });

            const res = await request(app)
                .post('/payment/subscribe')
                .send({ planType: 'pro' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.subscriptionId).toBe('sub_123');
            expect(res.body.clientSecret).toBe('pi_secret_abc');
            expect(paymentService.createSubscription).toHaveBeenCalledWith('test-user-id', 'pro');
        });

        it('should return 500 when service throws', async () => {
            paymentService.createSubscription.mockRejectedValue(new Error('Stripe error'));

            const res = await request(app)
                .post('/payment/subscribe')
                .send({ planType: 'pro' });

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Stripe error');
        });
    });

    describe('POST /payment/cancel', () => {
        it('should cancel subscription and return success message', async () => {
            paymentService.cancelSubscription.mockResolvedValue({
                success: true,
                message: 'Subscription will be cancelled at period end. Access continues until then.'
            });

            const res = await request(app).post('/payment/cancel');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toMatch(/cancelled at period end/);
            expect(paymentService.cancelSubscription).toHaveBeenCalledWith('test-user-id');
        });

        it('should return 500 when service throws', async () => {
            paymentService.cancelSubscription.mockRejectedValue(new Error('No subscription'));

            const res = await request(app).post('/payment/cancel');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('No subscription');
        });
    });

    describe('POST /payment/webhook', () => {
        it('should process a valid stripe webhook event', async () => {
            const mockEvent = {
                type: 'checkout.session.completed',
                data: { object: {} }
            };

            stripe._webhooksConstructEvent.mockReturnValue(mockEvent);
            paymentService.handleWebhook.mockResolvedValue({ success: true });

            const res = await request(app)
                .post('/payment/webhook')
                .set('stripe-signature', 'test-sig')
                .send('{}');

            expect(res.status).toBe(200);
            expect(res.body.received).toBe(true);
            expect(paymentService.handleWebhook).toHaveBeenCalledWith(mockEvent);
        });

        it('should return 400 when stripe signature verification fails', async () => {
            stripe._webhooksConstructEvent.mockImplementation(() => {
                throw new Error('Invalid signature');
            });

            const res = await request(app)
                .post('/payment/webhook')
                .set('stripe-signature', 'bad-sig')
                .send('{}');

            expect(res.status).toBe(400);
            expect(res.text).toContain('Webhook Error: Invalid signature');
            expect(paymentService.handleWebhook).not.toHaveBeenCalled();
        });

        it('should return 500 when webhook handling fails', async () => {
            const mockEvent = {
                type: 'customer.subscription.deleted',
                data: { object: {} }
            };

            stripe._webhooksConstructEvent.mockReturnValue(mockEvent);
            paymentService.handleWebhook.mockResolvedValue({ success: false, error: 'Handler error' });

            const res = await request(app)
                .post('/payment/webhook')
                .set('stripe-signature', 'test-sig')
                .send('{}');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Handler error');
        });

        it('should return received true for unhandled event types', async () => {
            const mockEvent = {
                type: 'invoice.payment_succeeded',
                data: { object: {} }
            };

            stripe._webhooksConstructEvent.mockReturnValue(mockEvent);

            const res = await request(app)
                .post('/payment/webhook')
                .set('stripe-signature', 'test-sig')
                .send('{}');

            expect(res.status).toBe(200);
            expect(res.body.received).toBe(true);
            expect(paymentService.handleWebhook).not.toHaveBeenCalled();
        });
    });
});
