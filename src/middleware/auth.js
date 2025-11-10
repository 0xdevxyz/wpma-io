const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

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
        console.error('Auth middleware error:', error);
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
        
        // Find site by API key
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
        console.error('WordPress API auth error:', error);
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