const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../config/database');
const { ValidationError } = require('../utils/errors');
const { client: redisClient } = require('../config/redis');
const { logger } = require('../utils/logger');

class AuthController {
    async register(req, res) {
        try {
            const { email, password, firstName, lastName } = req.body;
            
            // Validate input
            if (!email || !password || !firstName || !lastName) {
                throw new ValidationError('All fields are required');
            }
            
            // Check if user already exists
            const existingUser = await query(
                'SELECT id FROM users WHERE email = $1',
                [email]
            );
            
            if (existingUser.rows.length > 0) {
                throw new ValidationError('User already exists');
            }
            
            // Hash password
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            
            // Create user
            const result = await query(
                `INSERT INTO users (email, password_hash, first_name, last_name, plan_type)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id, email, first_name, last_name, plan_type`,
                [email, hashedPassword, firstName, lastName, 'basic']
            );
            
            const user = result.rows[0];
            
            // Generate JWT token
            const token = jwt.sign(
                { userId: user.id, email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: '30d' }
            );
            
            res.status(201).json({
                success: true,
                message: 'User created successfully',
                data: {
                    user: {
                        id: user.id,
                        email: user.email,
                        firstName: user.first_name,
                        lastName: user.last_name,
                        planType: user.plan_type
                    },
                    token
                }
            });
        } catch (error) {
            console.error('Registration error:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Registration failed'
            });
        }
    }
    
    async login(req, res) {
        try {
            const { email, password } = req.body;
            
            // Validate input
            if (!email || !password) {
                throw new ValidationError('Email and password are required');
            }
            
            // Find user
            const result = await query(
                'SELECT id, email, password_hash, first_name, last_name, plan_type FROM users WHERE email = $1',
                [email]
            );
            
            if (result.rows.length === 0) {
                throw new ValidationError('Invalid credentials');
            }
            
            const user = result.rows[0];
            
            // Verify password
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            
            if (!isValidPassword) {
                throw new ValidationError('Invalid credentials');
            }
            
            // Generate JWT token
            const token = jwt.sign(
                { userId: user.id, email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: '30d' }
            );
            
            // Update last login
            await query(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
                [user.id]
            );
            
            res.json({
                success: true,
                message: 'Login successful',
                data: {
                    user: {
                        id: user.id,
                        email: user.email,
                        firstName: user.first_name,
                        lastName: user.last_name,
                        planType: user.plan_type
                    },
                    token
                }
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Login failed'
            });
        }
    }
    
    async refreshToken(req, res) {
        try {
            const { userId } = req.user;
            
            // Get updated user info
            const result = await query(
                'SELECT id, email, first_name, last_name, plan_type FROM users WHERE id = $1',
                [userId]
            );
            
            if (result.rows.length === 0) {
                throw new ValidationError('User not found');
            }
            
            const user = result.rows[0];
            
            // Generate new token
            const token = jwt.sign(
                { userId: user.id, email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: '30d' }
            );
            
            res.json({
                success: true,
                data: {
                    user: {
                        id: user.id,
                        email: user.email,
                        firstName: user.first_name,
                        lastName: user.last_name,
                        planType: user.plan_type
                    },
                    token
                }
            });
        } catch (error) {
            console.error('Token refresh error:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Token refresh failed'
            });
        }
    }
    
    async me(req, res) {
        try {
            const { userId } = req.user;
            
            const result = await query(
                `SELECT u.id, u.email, u.first_name, u.last_name, u.plan_type, u.created_at,
                        COUNT(s.id) as site_count
                 FROM users u
                 LEFT JOIN sites s ON u.id = s.user_id AND s.status = 'active'
                 WHERE u.id = $1
                 GROUP BY u.id, u.email, u.first_name, u.last_name, u.plan_type, u.created_at`,
                [userId]
            );
            
            if (result.rows.length === 0) {
                throw new ValidationError('User not found');
            }
            
            const user = result.rows[0];
            
            res.json({
                success: true,
                data: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    planType: user.plan_type,
                    siteCount: parseInt(user.site_count),
                    createdAt: user.created_at
                }
            });
        } catch (error) {
            console.error('Get user error:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Failed to get user info'
            });
        }
    }
    // POST /api/v1/auth/logout
    async logout(req, res) {
        try {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];

            if (token) {
                // Token in Redis blacklisten — TTL = 30 Tage (JWT Expiry)
                await redisClient.set(`blacklist:${token}`, '1', { EX: 30 * 24 * 60 * 60 });
            }

            res.json({ success: true, message: 'Logged out successfully' });
        } catch (error) {
            logger.error('Logout error:', { error: error.message });
            res.status(500).json({ success: false, error: 'Logout failed' });
        }
    }

    // POST /api/v1/auth/forgot-password
    async forgotPassword(req, res) {
        try {
            const { email } = req.body;
            if (!email) throw new ValidationError('Email is required');

            const result = await query('SELECT id FROM users WHERE email = $1', [email]);

            // Immer 200 zurückgeben — kein User-Enumeration
            if (result.rows.length === 0) {
                return res.json({ success: true, message: 'If this email exists, a reset link has been sent.' });
            }

            const userId = result.rows[0].id;
            const resetToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

            // Reset-Token in Redis speichern — 1 Stunde gültig
            await redisClient.set(`pwreset:${tokenHash}`, userId.toString(), { EX: 60 * 60 });

            // TODO: E-Mail senden wenn SMTP konfiguriert
            // const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
            // await emailService.sendPasswordReset(email, resetUrl);

            logger.info('Password reset token generated', { userId, email });

            // Im Dev-Modus Token zurückgeben, in Produktion nur Success
            const devResponse = process.env.NODE_ENV !== 'production' ? { resetToken } : {};

            res.json({
                success: true,
                message: 'If this email exists, a reset link has been sent.',
                ...devResponse
            });
        } catch (error) {
            logger.error('Forgot password error:', { error: error.message });
            res.status(400).json({ success: false, error: error.message });
        }
    }

    // POST /api/v1/auth/reset-password
    async resetPassword(req, res) {
        try {
            const { token, newPassword } = req.body;
            if (!token || !newPassword) throw new ValidationError('Token and new password are required');
            if (newPassword.length < 8) throw new ValidationError('Password must be at least 8 characters');

            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            const userId = await redisClient.get(`pwreset:${tokenHash}`);

            if (!userId) {
                return res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
            }

            const hashedPassword = await bcrypt.hash(newPassword, 12);
            await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, userId]);

            // Token nach Nutzung löschen
            await redisClient.del(`pwreset:${tokenHash}`);

            logger.info('Password reset successful', { userId });
            res.json({ success: true, message: 'Password reset successfully' });
        } catch (error) {
            logger.error('Reset password error:', { error: error.message });
            res.status(400).json({ success: false, error: error.message });
        }
    }
}

module.exports = new AuthController(); 