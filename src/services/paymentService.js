const stripe = require('stripe');
const { query } = require('../config/database');

class PaymentService {
    constructor() {
        this.stripe = stripe(process.env.STRIPE_SECRET_KEY);
    }

    async createSubscription(userId, planType) {
        try {
            // Get user information
            const userResult = await query(
                'SELECT * FROM users WHERE id = $1',
                [userId]
            );

            if (userResult.rows.length === 0) {
                throw new Error('User not found');
            }

            const user = userResult.rows[0];

            // Create or get customer
            let customerId = user.stripe_customer_id;
            if (!customerId) {
                const customer = await this.stripe.customers.create({
                    email: user.email,
                    name: `${user.first_name} ${user.last_name}`,
                    metadata: {
                        user_id: userId.toString()
                    }
                });
                customerId = customer.id;

                // Update user with customer ID
                await query(
                    'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
                    [customerId, userId]
                );
            }

            // Get plan price ID
            const priceId = this.getPriceIdForPlan(planType);

            // Create subscription
            const subscription = await this.stripe.subscriptions.create({
                customer: customerId,
                items: [{ price: priceId }],
                payment_behavior: 'default_incomplete',
                payment_settings: { save_default_payment_method: 'on_subscription' },
                expand: ['latest_invoice.payment_intent'],
                metadata: {
                    user_id: userId.toString(),
                    plan_type: planType
                }
            });

            // Update user plan
            await query(
                'UPDATE users SET plan_type = $1, stripe_subscription_id = $2 WHERE id = $3',
                [planType, subscription.id, userId]
            );

            return {
                success: true,
                subscriptionId: subscription.id,
                clientSecret: subscription.latest_invoice.payment_intent.client_secret
            };

        } catch (error) {
            console.error('Subscription creation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async cancelSubscription(userId) {
        try {
            const userResult = await query(
                'SELECT stripe_subscription_id FROM users WHERE id = $1',
                [userId]
            );

            if (userResult.rows.length === 0 || !userResult.rows[0].stripe_subscription_id) {
                throw new Error('No active subscription found');
            }

            const subscriptionId = userResult.rows[0].stripe_subscription_id;

            // Cancel subscription in Stripe
            await this.stripe.subscriptions.update(subscriptionId, {
                cancel_at_period_end: true
            });

            // Update user plan to basic
            await query(
                'UPDATE users SET plan_type = $1 WHERE id = $2',
                ['basic', userId]
            );

            return {
                success: true,
                message: 'Subscription cancelled successfully'
            };

        } catch (error) {
            console.error('Subscription cancellation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async updateSubscription(userId, newPlanType) {
        try {
            const userResult = await query(
                'SELECT stripe_subscription_id FROM users WHERE id = $1',
                [userId]
            );

            if (userResult.rows.length === 0 || !userResult.rows[0].stripe_subscription_id) {
                // Create new subscription if none exists
                return await this.createSubscription(userId, newPlanType);
            }

            const subscriptionId = userResult.rows[0].stripe_subscription_id;
            const newPriceId = this.getPriceIdForPlan(newPlanType);

            // Update subscription in Stripe
            const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
            await this.stripe.subscriptions.update(subscriptionId, {
                items: [{
                    id: subscription.items.data[0].id,
                    price: newPriceId,
                }],
                metadata: {
                    plan_type: newPlanType
                }
            });

            // Update user plan
            await query(
                'UPDATE users SET plan_type = $1 WHERE id = $2',
                [newPlanType, userId]
            );

            return {
                success: true,
                message: 'Subscription updated successfully'
            };

        } catch (error) {
            console.error('Subscription update error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async handleWebhook(event) {
        try {
            switch (event.type) {
                case 'invoice.payment_succeeded':
                    await this.handlePaymentSucceeded(event.data.object);
                    break;
                case 'invoice.payment_failed':
                    await this.handlePaymentFailed(event.data.object);
                    break;
                case 'customer.subscription.deleted':
                    await this.handleSubscriptionDeleted(event.data.object);
                    break;
                case 'customer.subscription.updated':
                    await this.handleSubscriptionUpdated(event.data.object);
                    break;
            }

            return {
                success: true,
                message: 'Webhook processed successfully'
            };

        } catch (error) {
            console.error('Webhook handling error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async handlePaymentSucceeded(invoice) {
        const customerId = invoice.customer;
        
        // Get user by customer ID
        const userResult = await query(
            'SELECT * FROM users WHERE stripe_customer_id = $1',
            [customerId]
        );

        if (userResult.rows.length > 0) {
            const user = userResult.rows[0];
            
            // Update user status
            await query(
                'UPDATE users SET payment_status = $1, last_payment_date = CURRENT_TIMESTAMP WHERE id = $2',
                ['active', user.id]
            );

            // Log payment
            await query(
                `INSERT INTO payment_logs (user_id, amount, currency, status, stripe_invoice_id)
                 VALUES ($1, $2, $3, $4, $5)`,
                [user.id, invoice.amount_paid, invoice.currency, 'succeeded', invoice.id]
            );
        }
    }

    async handlePaymentFailed(invoice) {
        const customerId = invoice.customer;
        
        const userResult = await query(
            'SELECT * FROM users WHERE stripe_customer_id = $1',
            [customerId]
        );

        if (userResult.rows.length > 0) {
            const user = userResult.rows[0];
            
            // Update user status
            await query(
                'UPDATE users SET payment_status = $1 WHERE id = $2',
                ['past_due', user.id]
            );

            // Log failed payment
            await query(
                `INSERT INTO payment_logs (user_id, amount, currency, status, stripe_invoice_id)
                 VALUES ($1, $2, $3, $4, $5)`,
                [user.id, invoice.amount_due, invoice.currency, 'failed', invoice.id]
            );
        }
    }

    async handleSubscriptionDeleted(subscription) {
        const customerId = subscription.customer;
        
        const userResult = await query(
            'SELECT * FROM users WHERE stripe_customer_id = $1',
            [customerId]
        );

        if (userResult.rows.length > 0) {
            const user = userResult.rows[0];
            
            // Downgrade to basic plan
            await query(
                'UPDATE users SET plan_type = $1, payment_status = $2 WHERE id = $3',
                ['basic', 'cancelled', user.id]
            );
        }
    }

    async handleSubscriptionUpdated(subscription) {
        const customerId = subscription.customer;
        const planType = subscription.metadata.plan_type;
        
        const userResult = await query(
            'SELECT * FROM users WHERE stripe_customer_id = $1',
            [customerId]
        );

        if (userResult.rows.length > 0) {
            const user = userResult.rows[0];
            
            // Update user plan
            await query(
                'UPDATE users SET plan_type = $1 WHERE id = $2',
                [planType, user.id]
            );
        }
    }

    async createPaymentIntent(amount, currency = 'eur') {
        try {
            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: amount,
                currency: currency,
                automatic_payment_methods: {
                    enabled: true,
                },
            });

            return {
                success: true,
                clientSecret: paymentIntent.client_secret
            };

        } catch (error) {
            console.error('Payment intent creation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getSubscriptionStatus(userId) {
        try {
            const userResult = await query(
                'SELECT plan_type, payment_status, stripe_subscription_id FROM users WHERE id = $1',
                [userId]
            );

            if (userResult.rows.length === 0) {
                throw new Error('User not found');
            }

            const user = userResult.rows[0];

            if (!user.stripe_subscription_id) {
                return {
                    success: true,
                    status: 'no_subscription',
                    plan: user.plan_type
                };
            }

            // Get subscription from Stripe
            const subscription = await this.stripe.subscriptions.retrieve(user.stripe_subscription_id);

            return {
                success: true,
                status: subscription.status,
                plan: user.plan_type,
                currentPeriodEnd: subscription.current_period_end,
                cancelAtPeriodEnd: subscription.cancel_at_period_end
            };

        } catch (error) {
            console.error('Subscription status error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async checkPlanLimits(userId, action) {
        try {
            const userResult = await query(
                'SELECT plan_type FROM users WHERE id = $1',
                [userId]
            );

            if (userResult.rows.length === 0) {
                throw new Error('User not found');
            }

            const planType = userResult.rows[0].plan_type;
            const limits = this.getPlanLimits(planType);

            switch (action) {
                case 'create_site':
                    const siteCount = await this.getUserSiteCount(userId);
                    return {
                        allowed: siteCount < limits.maxSites,
                        current: siteCount,
                        limit: limits.maxSites
                    };
                case 'create_backup':
                    const backupCount = await this.getUserBackupCount(userId);
                    return {
                        allowed: backupCount < limits.maxBackups,
                        current: backupCount,
                        limit: limits.maxBackups
                    };
                case 'security_scan':
                    return {
                        allowed: limits.securityScans,
                        current: 0,
                        limit: limits.securityScans
                    };
                default:
                    return {
                        allowed: true,
                        current: 0,
                        limit: 0
                    };
            }

        } catch (error) {
            console.error('Plan limits check error:', error);
            return {
                allowed: false,
                error: error.message
            };
        }
    }

    async getUserSiteCount(userId) {
        const result = await query(
            'SELECT COUNT(*) FROM sites WHERE user_id = $1 AND status = $2',
            [userId, 'active']
        );
        return parseInt(result.rows[0].count);
    }

    async getUserBackupCount(userId) {
        const result = await query(
            `SELECT COUNT(*) FROM backups b
             JOIN sites s ON b.site_id = s.id
             WHERE s.user_id = $1 AND b.status = $2`,
            [userId, 'completed']
        );
        return parseInt(result.rows[0].count);
    }

    getPlanLimits(planType) {
        const limits = {
            basic: {
                maxSites: 1,
                maxBackups: 5,
                securityScans: true,
                aiInsights: false,
                retentionDays: 30
            },
            pro: {
                maxSites: 25,
                maxBackups: 100,
                securityScans: true,
                aiInsights: true,
                retentionDays: 180
            },
            enterprise: {
                maxSites: -1, // Unlimited
                maxBackups: -1, // Unlimited
                securityScans: true,
                aiInsights: true,
                retentionDays: 365
            }
        };

        return limits[planType] || limits.basic;
    }

    getPriceIdForPlan(planType) {
        const prices = {
            basic: process.env.STRIPE_BASIC_PRICE_ID,
            pro: process.env.STRIPE_PRO_PRICE_ID,
            enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID
        };

        return prices[planType];
    }

    async createUsageRecord(subscriptionItemId, quantity, timestamp = Math.floor(Date.now() / 1000)) {
        try {
            await this.stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
                quantity: quantity,
                timestamp: timestamp,
                action: 'increment',
            });

            return {
                success: true,
                message: 'Usage record created'
            };

        } catch (error) {
            console.error('Usage record creation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new PaymentService(); 