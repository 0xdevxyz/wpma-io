/**
 * Sentry Error-Tracking Konfiguration
 * 
 * Konfiguriert Sentry für:
 * - Automatisches Error-Catching
 * - Performance-Monitoring
 * - Request-Tracking
 * - User-Context
 */

const Sentry = require('@sentry/node');
const { logger } = require('../utils/logger');

/**
 * Initialisiert Sentry wenn DSN konfiguriert ist
 * @returns {boolean} true wenn erfolgreich initialisiert
 */
const initializeSentry = () => {
    const SENTRY_DSN = process.env.SENTRY_DSN;
    
    if (!SENTRY_DSN) {
        logger.info('Sentry DSN not configured - error tracking disabled');
        return false;
    }

    try {
        Sentry.init({
            dsn: SENTRY_DSN,
            environment: process.env.NODE_ENV || 'development',
            release: process.env.APP_VERSION || '1.0.0',
            
            // Performance Monitoring
            tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
            
            // Nur in Production aktivieren
            enabled: process.env.NODE_ENV === 'production' || process.env.SENTRY_FORCE_ENABLE === 'true',
            
            // Sensitive Daten filtern
            beforeSend(event, hint) {
                // Passwörter und Tokens aus Request-Body entfernen
                if (event.request && event.request.data) {
                    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authorization'];
                    sensitiveFields.forEach(field => {
                        if (event.request.data[field]) {
                            event.request.data[field] = '[REDACTED]';
                        }
                    });
                }
                
                // Headers filtern
                if (event.request && event.request.headers) {
                    if (event.request.headers.authorization) {
                        event.request.headers.authorization = '[REDACTED]';
                    }
                    if (event.request.headers.cookie) {
                        event.request.headers.cookie = '[REDACTED]';
                    }
                }
                
                return event;
            },
            
            // Bestimmte Fehler ignorieren
            ignoreErrors: [
                // Rate-Limiting
                'Too many requests',
                // Abgebrochene Verbindungen
                'ECONNRESET',
                'ETIMEDOUT',
                // Client-Fehler
                'Invalid token',
                'Token expired',
            ],
            
            // Integrations konfigurieren
            integrations: [
                // HTTP-Integration für Request-Tracking
                Sentry.httpIntegration(),
                // Express-Integration
                Sentry.expressIntegration(),
            ],
        });

        logger.info('Sentry error tracking initialized', {
            environment: process.env.NODE_ENV,
            sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0
        });
        
        return true;
    } catch (error) {
        logger.error('Failed to initialize Sentry', { error: error.message });
        return false;
    }
};

/**
 * Sentry Request-Handler Middleware
 * Muss VOR allen anderen Routes eingebunden werden
 */
const sentryRequestHandler = () => {
    if (!process.env.SENTRY_DSN) {
        return (req, res, next) => next();
    }
    return Sentry.Handlers.requestHandler();
};

/**
 * Sentry Tracing-Handler für Performance-Monitoring
 * Muss VOR allen anderen Routes eingebunden werden
 */
const sentryTracingHandler = () => {
    if (!process.env.SENTRY_DSN) {
        return (req, res, next) => next();
    }
    return Sentry.Handlers.tracingHandler();
};

/**
 * Sentry Error-Handler Middleware
 * Muss NACH allen Routes aber VOR dem Error-Handler eingebunden werden
 */
const sentryErrorHandler = () => {
    if (!process.env.SENTRY_DSN) {
        return (err, req, res, next) => next(err);
    }
    return Sentry.Handlers.errorHandler({
        shouldHandleError(error) {
            // Nur Server-Fehler (5xx) an Sentry senden
            return error.status === undefined || error.status >= 500;
        }
    });
};

/**
 * Manuell einen Error an Sentry senden
 */
const captureError = (error, context = {}) => {
    if (!process.env.SENTRY_DSN) {
        logger.error('Error (Sentry disabled)', { error: error.message, ...context });
        return;
    }
    
    Sentry.withScope((scope) => {
        // Extra Context hinzufügen
        Object.entries(context).forEach(([key, value]) => {
            scope.setExtra(key, value);
        });
        
        Sentry.captureException(error);
    });
};

/**
 * User-Context für Sentry setzen
 * Sollte nach erfolgreicher Authentifizierung aufgerufen werden
 */
const setUserContext = (user) => {
    if (!process.env.SENTRY_DSN) return;
    
    Sentry.setUser({
        id: user.userId || user.id,
        email: user.email,
        // Keine sensiblen Daten!
    });
};

/**
 * Sentry-Context für Request setzen
 */
const setSentryContext = (req, res, next) => {
    if (!process.env.SENTRY_DSN) return next();
    
    Sentry.setContext('request', {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip
    });
    
    if (req.user) {
        setUserContext(req.user);
    }
    
    next();
};

/**
 * Manuelles Event an Sentry senden
 */
const captureMessage = (message, level = 'info', context = {}) => {
    if (!process.env.SENTRY_DSN) return;
    
    Sentry.withScope((scope) => {
        scope.setLevel(level);
        Object.entries(context).forEach(([key, value]) => {
            scope.setExtra(key, value);
        });
        Sentry.captureMessage(message);
    });
};

module.exports = {
    initializeSentry,
    sentryRequestHandler,
    sentryTracingHandler,
    sentryErrorHandler,
    captureError,
    captureMessage,
    setUserContext,
    setSentryContext,
    Sentry
};


