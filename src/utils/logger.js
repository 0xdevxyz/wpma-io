/**
 * Winston Logger Konfiguration für WPMA.io
 * 
 * Strukturiertes Logging mit:
 * - JSON-Format für Production
 * - Farbige Console-Ausgabe für Development
 * - Log-Level Konfiguration via ENV
 * - Request-ID Tracking
 */

const winston = require('winston');
const path = require('path');

// Log-Level aus ENV oder default 'info'
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Custom Format für bessere Lesbarkeit
const customFormat = winston.format.printf(({ level, message, timestamp, requestId, userId, ...metadata }) => {
    let meta = '';
    if (Object.keys(metadata).length > 0) {
        // Fehler-Stack separat behandeln
        if (metadata.stack) {
            meta = `\n${metadata.stack}`;
            delete metadata.stack;
        }
        if (Object.keys(metadata).length > 0) {
            meta += ` ${JSON.stringify(metadata)}`;
        }
    }
    
    const reqId = requestId ? `[${requestId}]` : '';
    const user = userId ? `[User:${userId}]` : '';
    
    return `${timestamp} ${level.toUpperCase()} ${reqId}${user} ${message}${meta}`;
});

// Logger-Instanz erstellen
const logger = winston.createLogger({
    level: LOG_LEVEL,
    defaultMeta: { service: 'wpma-api' },
    transports: []
});

// Development: Farbige Console-Ausgabe
if (NODE_ENV === 'development') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'HH:mm:ss' }),
            customFormat
        )
    }));
} else {
    // Production: JSON-Format für Log-Aggregation
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
        )
    }));
}

// Optionales File-Logging (wenn LOG_FILE gesetzt)
if (process.env.LOG_FILE) {
    logger.add(new winston.transports.File({
        filename: process.env.LOG_FILE,
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
        ),
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
        tailable: true
    }));
}

// Error-Log separat speichern
if (process.env.ERROR_LOG_FILE) {
    logger.add(new winston.transports.File({
        filename: process.env.ERROR_LOG_FILE,
        level: 'error',
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
        ),
        maxsize: 10 * 1024 * 1024,
        maxFiles: 5
    }));
}

/**
 * Request-Logger Middleware
 * Loggt alle eingehenden HTTP-Requests
 */
const requestLogger = (req, res, next) => {
    const startTime = Date.now();
    
    // Request-ID generieren oder aus Header übernehmen
    req.requestId = req.headers['x-request-id'] || 
                    `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // User-ID wenn authentifiziert
    const userId = req.user?.userId;

    // Response-Ende abfangen für Logging
    const originalEnd = res.end;
    res.end = function(...args) {
        const duration = Date.now() - startTime;
        const logLevel = res.statusCode >= 500 ? 'error' : 
                        res.statusCode >= 400 ? 'warn' : 'info';
        
        logger.log(logLevel, `${req.method} ${req.originalUrl}`, {
            requestId: req.requestId,
            userId,
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            userAgent: req.headers['user-agent'],
            ip: req.ip || req.connection.remoteAddress
        });

        originalEnd.apply(res, args);
    };

    next();
};

/**
 * Child-Logger mit Context erstellen
 * Nützlich für Service-spezifisches Logging
 */
const createChildLogger = (context) => {
    return logger.child(context);
};

/**
 * Hilfsfunktionen für häufige Log-Szenarien
 */
const loggers = {
    // API-Fehler loggen
    apiError: (error, req = {}) => {
        logger.error('API Error', {
            requestId: req.requestId,
            userId: req.user?.userId,
            error: error.message,
            stack: error.stack,
            url: req.originalUrl,
            method: req.method
        });
    },

    // Datenbank-Operationen loggen
    dbQuery: (operation, table, duration, success = true) => {
        logger.debug(`DB ${operation}`, {
            operation,
            table,
            duration: `${duration}ms`,
            success
        });
    },

    // Externe API-Calls loggen
    externalApi: (service, endpoint, duration, statusCode) => {
        const level = statusCode >= 400 ? 'warn' : 'debug';
        logger.log(level, `External API: ${service}`, {
            service,
            endpoint,
            duration: `${duration}ms`,
            statusCode
        });
    },

    // Job-Ausführung loggen
    job: (jobName, status, details = {}) => {
        const level = status === 'error' ? 'error' : 
                     status === 'completed' ? 'info' : 'debug';
        logger.log(level, `Job: ${jobName}`, {
            job: jobName,
            status,
            ...details
        });
    },

    // Security-Events loggen
    security: (event, details = {}) => {
        logger.warn(`Security: ${event}`, {
            securityEvent: event,
            ...details
        });
    },

    // Performance-Metriken loggen
    performance: (metric, value, unit = 'ms') => {
        logger.debug(`Performance: ${metric}`, {
            metric,
            value,
            unit
        });
    }
};

module.exports = {
    logger,
    requestLogger,
    createChildLogger,
    ...loggers
};


