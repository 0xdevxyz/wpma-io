/**
 * Environment variable validation at startup.
 * The app will exit immediately if required vars are missing.
 */

const REQUIRED = [
    'DATABASE_URL',
    'JWT_SECRET',
];

const RECOMMENDED = [
    'REDIS_HOST',
    'ANTHROPIC_API_KEY',
    'SENTRY_DSN',
    'FRONTEND_URL',
];

function validateEnv() {
    const missing = REQUIRED.filter((key) => !process.env[key]);

    if (missing.length > 0) {
        console.error(`❌ FATAL: Missing required environment variables: ${missing.join(', ')}`);
        process.exit(1);
    }

    const missingRecommended = RECOMMENDED.filter((key) => !process.env[key]);
    if (missingRecommended.length > 0) {
        console.warn(`⚠️  WARNING: Missing recommended environment variables: ${missingRecommended.join(', ')}`);
    }
}

module.exports = { validateEnv };
