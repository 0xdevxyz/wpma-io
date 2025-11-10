const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { ValidationError } = require('../utils/errors');

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
}

module.exports = new AuthController(); 