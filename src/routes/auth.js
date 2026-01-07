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

// Protected routes
router.get('/me', authenticateToken, authController.me);
router.post('/refresh', authenticateToken, authController.refreshToken);

module.exports = router; 