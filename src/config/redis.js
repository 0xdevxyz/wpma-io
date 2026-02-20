const redis = require('redis');

const redisConfig = {
    socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
            if (retries > 10) {
                console.error('Redis: Max retries reached, giving up');
                return new Error('Redis max retries reached');
            }
            return Math.min(retries * 100, 3000);
        }
    },
    database: parseInt(process.env.REDIS_DB || '0', 10),
};

// Password optional — kein crash wenn nicht gesetzt
if (process.env.REDIS_PASSWORD) {
    redisConfig.password = process.env.REDIS_PASSWORD;
}

const client = redis.createClient(redisConfig);

client.on('error', (err) => {
    console.error('Redis client error:', err.message);
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
