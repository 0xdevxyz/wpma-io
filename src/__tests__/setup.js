/**
 * Jest Setup für WPMA.io Tests
 * 
 * Diese Datei wird vor jedem Test ausgeführt
 */

// Environment-Variablen für Tests setzen
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_PASSWORD = 'test-redis-password';

// Console-Logs in Tests unterdrücken (optional)
if (process.env.SUPPRESS_LOGS === 'true') {
    global.console = {
        ...console,
        log: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        // Fehler sollen sichtbar bleiben
        error: console.error
    };
}

// Global Timeout erhöhen für langsame Tests
jest.setTimeout(10000);

// Globale Mocks
jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        log: jest.fn()
    },
    requestLogger: (req, res, next) => next(),
    apiError: jest.fn(),
    security: jest.fn(),
    job: jest.fn()
}));

jest.mock('../config/sentry', () => ({
    initializeSentry: jest.fn(() => true),
    sentryRequestHandler: () => (req, res, next) => next(),
    sentryTracingHandler: () => (req, res, next) => next(),
    sentryErrorHandler: () => (err, req, res, next) => next(err),
    captureError: jest.fn(),
    captureMessage: jest.fn(),
    setUserContext: jest.fn(),
    setSentryContext: (req, res, next) => next()
}));

// Cleanup nach allen Tests
afterAll(async () => {
    // Offene Handles schließen falls nötig
    await new Promise(resolve => setTimeout(resolve, 100));
});


