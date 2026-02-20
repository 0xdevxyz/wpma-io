const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { validate, sanitize } = require('../middleware/validate');
const { authSchemas } = require('../validators/schemas');

// Public routes mit Validierung
router.post('/register', 
    sanitize,
    validate(authSchemas.register),
    authController.register
);

router.post('/login',
    sanitize,
    validate(authSchemas.login),
    authController.login
);

// Password Reset (public)
router.post('/forgot-password', sanitize, authController.forgotPassword);
router.post('/reset-password', sanitize, authController.resetPassword);

// Protected routes
router.get('/me', authenticateToken, authController.me);
router.post('/refresh', authenticateToken, authController.refreshToken);
router.post('/logout', authenticateToken, authController.logout);

module.exports = router; 