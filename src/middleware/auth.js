const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { client: redisClient } = require('../config/redis');
const { logger } = require('../utils/logger');

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Access token required'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Redis Blacklist-Check (logout/revoked tokens)
        try {
            const isBlacklisted = await redisClient.get(`blacklist:${token}`);
            if (isBlacklisted) {
                return res.status(401).json({ success: false, error: 'Token has been revoked' });
            }
        } catch (redisErr) {
            logger.warn('Redis blacklist check failed, continuing:', { error: redisErr.message });
        }

        // Verify user still exists
        const result = await query(
            'SELECT id, email, plan_type FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }

        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            planType: result.rows[0].plan_type
        };

        next();
    } catch (error) {
        logger.error('Auth middleware error:', { error: error.message });
        return res.status(401).json({
            success: false,
            error: 'Invalid token'
        });
    }
};

const authenticateWordPressAPI = async (req, res, next) => {
    try {
        const apiKey = req.headers['authorization']?.replace('Bearer ', '');

        if (!apiKey) {
            return res.status(401).json({
                success: false,
                error: 'API key required'
            });
        }

        const result = await query(
            'SELECT id, user_id, domain, site_url FROM sites WHERE api_key = $1 AND status = $2',
            [apiKey, 'active']
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Invalid API key'
            });
        }

        req.site = result.rows[0];
        next();
    } catch (error) {
        logger.error('WordPress API auth error:', { error: error.message });
        return res.status(401).json({
            success: false,
            error: 'Authentication failed'
        });
    }
};

module.exports = {
    authenticateToken,
    authenticateWordPressAPI
};
