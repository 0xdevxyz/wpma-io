const request = require('supertest');
const express = require('express');

jest.mock('../../config/database', () => ({
    query: jest.fn()
}));

jest.mock('../../middleware/auth', () => ({
    authenticateToken: (req, res, next) => {
        req.user = { userId: 'user-uuid-1', planType: 'pro' };
        next();
    },
    authenticateWordPressAPI: (req, res, next) => next(),
    wpApiRateLimiter: (req, res, next) => next()
}));

jest.mock('../../middleware/validate', () => ({
    validate: () => (req, res, next) => next(),
    validateMultiple: () => (req, res, next) => next(),
    sanitize: (req, res, next) => next()
}));

const { query } = require('../../config/database');
const sitesController = require('../../controllers/sitesController');

function buildApp() {
    const app = express();
    app.use(express.json());

    const { authenticateToken } = require('../../middleware/auth');

    app.get('/sites', authenticateToken, sitesController.getSites.bind(sitesController));
    app.post('/sites', authenticateToken, sitesController.createSite.bind(sitesController));
    app.delete('/sites/:siteId', authenticateToken, sitesController.deleteSite.bind(sitesController));

    return app;
}

describe('SitesController', () => {
    let app;

    beforeAll(() => {
        app = buildApp();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /sites', () => {
        it('should return the list of active sites for the authenticated user', async () => {
            const siteRow = {
                id: 'site-uuid-1',
                domain: 'example.com',
                site_url: 'https://example.com',
                site_name: 'Example Site',
                health_score: 90,
                status: 'active',
                last_check: null,
                wordpress_version: '6.4',
                php_version: '8.2',
                created_at: new Date('2026-01-01'),
                last_plugin_connection: new Date('2026-01-02'),
                plugin_version: '1.0',
                setup_token: 'tok',
                setup_token_expires_at: new Date('2030-01-01'),
                setup_token_used: false,
                uptime_status: 'up',
                uptime_percent: '99.9',
                avg_response_ms: 250,
                plugins_updates: 2,
                themes_updates: 0,
                core_update_available: false
            };

            query.mockResolvedValueOnce({ rows: [siteRow] });

            const res = await request(app).get('/sites');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].domain).toBe('example.com');
            expect(res.body.data[0].healthScore).toBe(90);
            expect(res.body.data[0].isConnected).toBe(true);
        });

        it('should return an empty array when the user has no sites', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app).get('/sites');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(0);
        });
    });

    describe('POST /sites', () => {
        it('should create a site and return setup token', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ count: '0' }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({
                    rows: [{
                        id: 'site-new-1',
                        domain: 'newsite.com',
                        site_url: 'https://newsite.com',
                        site_name: 'New Site',
                        api_key: 'api-key-abc',
                        status: 'active',
                        setup_token: 'setup-token-xyz',
                        setup_token_expires_at: new Date('2026-01-02'),
                        created_at: new Date('2026-01-01')
                    }]
                });

            const res = await request(app)
                .post('/sites')
                .send({ domain: 'newsite.com', site_url: 'https://newsite.com' });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.domain).toBe('newsite.com');
            expect(res.body.data.setupToken).toBe('setup-token-xyz');
        });

        it('should return 400 when domain is missing', async () => {
            const res = await request(app)
                .post('/sites')
                .send({ site_url: 'https://newsite.com' });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });

    describe('DELETE /sites/:siteId', () => {
        it('should soft-delete a site owned by the user', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: 'site-uuid-1', domain: 'example.com' }] })
                .mockResolvedValueOnce({ rows: [] });

            const res = await request(app).delete('/sites/site-uuid-1');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Site deleted successfully');
            expect(query).toHaveBeenCalledWith(
                expect.stringContaining("SET status = $1"),
                expect.arrayContaining(['deleted'])
            );
        });

        it('should return 404 when site does not belong to the user', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app).delete('/sites/other-uuid');

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Site not found');
        });
    });
});
