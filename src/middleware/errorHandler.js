const { logger, apiError } = require('../utils/logger');
const { captureError } = require('../config/sentry');

/**
 * Zentrale Fehlerbehandlung für die WPMA API
 * 
 * Behandelt verschiedene Fehlertypen:
 * - Validierungsfehler (400)
 * - Authentifizierungsfehler (401)
 * - Autorisierungsfehler (403)
 * - Nicht gefunden (404)
 * - Konflikte (409)
 * - Server-Fehler (500)
 */
const errorHandler = (err, req, res, next) => {
    // Default error Objekt
    let error = {
        message: err.message || 'Internal Server Error',
        status: err.status || err.statusCode || 500,
        code: err.code || 'INTERNAL_ERROR'
    };

    // Validation errors (Joi, custom)
    if (err.name === 'ValidationError' || err.isJoi) {
        error.message = err.message;
        error.status = 400;
        error.code = 'VALIDATION_ERROR';
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        error.message = 'Invalid token';
        error.status = 401;
        error.code = 'INVALID_TOKEN';
    }

    if (err.name === 'TokenExpiredError') {
        error.message = 'Token expired';
        error.status = 401;
        error.code = 'TOKEN_EXPIRED';
    }

    // Database errors (PostgreSQL)
    if (err.code === '23505') { // Unique violation
        error.message = 'Resource already exists';
        error.status = 409;
        error.code = 'DUPLICATE_ENTRY';
    }

    if (err.code === '23503') { // Foreign key violation
        error.message = 'Referenced resource not found';
        error.status = 400;
        error.code = 'FOREIGN_KEY_ERROR';
    }

    if (err.code === '23502') { // Not null violation
        error.message = 'Required field is missing';
        error.status = 400;
        error.code = 'NOT_NULL_ERROR';
    }

    if (err.code === 'ECONNREFUSED') {
        error.message = 'Service temporarily unavailable';
        error.status = 503;
        error.code = 'SERVICE_UNAVAILABLE';
    }

    // Rate limit errors
    if (err.status === 429) {
        error.message = 'Too many requests, please try again later';
        error.code = 'RATE_LIMITED';
    }

    // Nur Server-Fehler loggen und an Sentry senden
    if (error.status >= 500) {
        // Strukturiertes Error-Logging
        apiError(err, req);
        
        // An Sentry senden
        captureError(err, {
            requestId: req.requestId,
            userId: req.user?.userId,
            url: req.originalUrl,
            method: req.method
        });
    } else if (error.status >= 400) {
        // Client-Fehler nur als Warning loggen
        logger.warn('Client error', {
            requestId: req.requestId,
            status: error.status,
            code: error.code,
            message: error.message,
            url: req.originalUrl
        });
    }

    // Response senden
    const response = {
        success: false,
        error: error.message,
        code: error.code
    };

    // Nur in Development: Stack-Trace hinzufügen
    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
        response.details = err.details || undefined;
    }

    // Request-ID für Support-Anfragen hinzufügen
    if (req.requestId) {
        response.requestId = req.requestId;
    }

    res.status(error.status).json(response);
};

/**
 * 404 Not Found Handler
 * Für nicht existierende Routes
 */
const notFoundHandler = (req, res) => {
    logger.warn('Route not found', {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl
    });

    res.status(404).json({
        success: false,
        error: 'Route not found',
        code: 'NOT_FOUND',
        requestId: req.requestId
    });
};

module.exports = { 
    errorHandler,
    notFoundHandler 
}; 