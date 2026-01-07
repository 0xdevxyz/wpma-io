const redis = require('redis');

// Sicherheitscheck: REDIS_PASSWORD ist erforderlich in Production
if (process.env.NODE_ENV === 'production' && !process.env.REDIS_PASSWORD) {
    console.error('❌ FATAL: REDIS_PASSWORD environment variable is required in production');
    process.exit(1);
}

const client = redis.createClient({
    socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        connectTimeout: 5000,
    },
    password: process.env.REDIS_PASSWORD || undefined,
    database: parseInt(process.env.REDIS_DB || '0', 10),
    // Moderne Redis-Client retry Konfiguration
    socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        reconnectStrategy: (retries) => {
            if (retries > 10) {
                console.error('Redis: Max retries reached, giving up');
                return new Error('Redis max retries reached');
            }
            // Exponential backoff: 100ms, 200ms, 400ms, ...
            return Math.min(retries * 100, 3000);
        }
    }
});

const initializeRedis = async () => {
    try {
        await client.connect();
        console.log('Redis connected successfully');
    } catch (error) {
        console.error('Redis connection failed:', error);
        throw error;
    }
};

module.exports = {
    client,
    initializeRedis
};
