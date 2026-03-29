const request = require('supertest');
const express = require('express');

jest.mock('../../config/database', () => ({
    query: jest.fn()
}));

jest.mock('bcryptjs', () => ({
    hash: jest.fn(),
    compare: jest.fn()
}));

jest.mock('jsonwebtoken', () => ({
    sign: jest.fn(),
    verify: jest.fn()
}));

jest.mock('../../config/redis', () => ({
    client: {
        set: jest.fn(),
        get: jest.fn(),
        del: jest.fn()
    }
}));

jest.mock('../../middleware/validate', () => ({
    validate: () => (req, res, next) => next(),
    sanitize: (req, res, next) => next()
}));

const { query } = require('../../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const authController = require('../../controllers/authController');

function buildApp() {
    const app = express();
    app.use(express.json());
    app.post('/auth/register', authController.register.bind(authController));
    app.post('/auth/login', authController.login.bind(authController));
    return app;
}

describe('AuthController', () => {
    let app;

    beforeAll(() => {
        app = buildApp();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /auth/register', () => {
        it('should create a user and return a token on success', async () => {
            query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({
                    rows: [{
                        id: 'uuid-1',
                        email: 'test@example.com',
                        first_name: 'Test',
                        last_name: 'User',
                        plan_type: 'basic'
                    }]
                });

            bcrypt.hash.mockResolvedValue('hashed_password');
            jwt.sign.mockReturnValue('mock.jwt.token');

            const res = await request(app)
                .post('/auth/register')
                .send({
                    email: 'test@example.com',
                    password: 'password123',
                    firstName: 'Test',
                    lastName: 'User'
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.token).toBe('mock.jwt.token');
            expect(res.body.data.user.email).toBe('test@example.com');
        });

        it('should return 400 when email already exists', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'existing-id' }] });

            const res = await request(app)
                .post('/auth/register')
                .send({
                    email: 'duplicate@example.com',
                    password: 'password123',
                    firstName: 'Dup',
                    lastName: 'User'
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('User already exists');
        });
    });

    describe('POST /auth/login', () => {
        it('should return a token on valid credentials', async () => {
            query
                .mockResolvedValueOnce({
                    rows: [{
                        id: 'uuid-1',
                        email: 'test@example.com',
                        password_hash: 'hashed_password',
                        first_name: 'Test',
                        last_name: 'User',
                        plan_type: 'basic'
                    }]
                })
                .mockResolvedValueOnce({ rows: [] });

            bcrypt.compare.mockResolvedValue(true);
            jwt.sign.mockReturnValue('mock.jwt.token');

            const res = await request(app)
                .post('/auth/login')
                .send({ email: 'test@example.com', password: 'password123' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.token).toBe('mock.jwt.token');
        });

        it('should return 400 when password is wrong', async () => {
            query.mockResolvedValueOnce({
                rows: [{
                    id: 'uuid-1',
                    email: 'test@example.com',
                    password_hash: 'hashed_password',
                    first_name: 'Test',
                    last_name: 'User',
                    plan_type: 'basic'
                }]
            });

            bcrypt.compare.mockResolvedValue(false);

            const res = await request(app)
                .post('/auth/login')
                .send({ email: 'test@example.com', password: 'wrongpassword' });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Invalid credentials');
        });

        it('should return 400 when user is not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/auth/login')
                .send({ email: 'noone@example.com', password: 'password123' });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Invalid credentials');
        });
    });
});
