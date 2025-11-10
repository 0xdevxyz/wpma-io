const redis = require('redis');

const client = redis.createClient({
    socket: {
        host: process.env.REDIS_HOST || 'shared-redis',
        port: process.env.REDIS_PORT || 6379
    },
    password: process.env.REDIS_PASSWORD || '04/jdoPGip+v2Yqoeo0+nNSIvxZsC/u+Q+E4qBrGA0E=',
    database: process.env.REDIS_DB || 3,
    retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
            return new Error('Redis server connection refused');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
            return new Error('Redis retry time exhausted');
        }
        if (options.attempt > 10) {
            return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
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
