const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const socketIo = require('socket.io');
const rateLimit = require('express-rate-limit');
const fs = require('fs');

// Environment laden
if (fs.existsSync('.env')) {
    require('dotenv').config();
}

// Logger und Sentry initialisieren (muss früh geladen werden)
const { logger, requestLogger } = require('./utils/logger');
const { 
    initializeSentry, 
    sentryRequestHandler, 
    sentryTracingHandler, 
    sentryErrorHandler,
    setSentryContext 
} = require('./config/sentry');

// Sentry initialisieren
initializeSentry();

logger.info('Starting WPMA API Server', { 
    nodeEnv: process.env.NODE_ENV,
    nodeVersion: process.version 
});


// Import Routes
const authRoutes = require('./routes/auth');
const sitesRoutes = require('./routes/sites');
const securityRoutes = require('./routes/security');
const backupRoutes = require('./routes/backup');
const performanceRoutes = require('./routes/performance');
const aiRoutes = require('./routes/ai');
const monitoringRoutes = require('./routes/monitoring');
const emailRecoveryRoutes = require('./routes/emailRecovery');
const updatesRoutes = require('./routes/updates');
const bulkRoutes = require('./routes/bulk');
const reportsRoutes = require('./routes/reports');
const teamRoutes = require('./routes/team');
const whiteLabelRoutes = require('./routes/whiteLabel');
const notificationsRoutes = require('./routes/notifications');
const chatRoutes = require('./routes/chat');
const stagingRoutes = require('./routes/staging');
const incrementalBackupRoutes = require('./routes/incrementalBackup');
const paymentRoutes = require('./routes/payment');

// Import Middleware
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { performanceMiddleware } = require('./middleware/performance');

// Import Services
const { initializeDatabase } = require('./config/database');
const { initializeRedis } = require('./config/redis');
const { startBackgroundJobs } = require('./services/jobService');

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 8000;

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Sentry Request Handler (muss als erstes eingebunden werden)
app.use(sentryRequestHandler());
app.use(sentryTracingHandler());

// Global Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS-Konfiguration mit dynamischer Origin-Prüfung
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
            return callback(null, true);
        }

        // Frontend domains (strenge Prüfung)
        const allowedFrontendOrigins = [
            'https://app.wpma.io',
            'http://localhost:3000',
            'http://127.0.0.1:3000'
        ];

        // Allow frontend domains
        if (allowedFrontendOrigins.includes(origin)) {
            return callback(null, true);
        }

        // WordPress-Plugin-Requests: nur bekannte Patterns erlauben
        return callback(new Error('CORS not allowed'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 600 // Cache preflight für 10 Minuten
};

app.use(cors(corsOptions));
app.use(limiter);

// Raw body für Stripe Webhook — muss VOR express.json() stehen
app.use('/api/v1/payment/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request-Logger (strukturiertes Logging)
app.use(requestLogger);

// Sentry Context setzen
app.use(setSentryContext);

app.use(performanceMiddleware);

// Make io accessible to routes
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/sites', sitesRoutes);
app.use('/api/v1/security', securityRoutes);
app.use('/api/v1/backup', backupRoutes);
app.use('/api/v1/performance', performanceRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/monitoring', monitoringRoutes);
app.use('/api/v1/email-recovery', emailRecoveryRoutes);
app.use('/api/v1/updates', updatesRoutes);
app.use('/api/v1/bulk', bulkRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/team', teamRoutes);
app.use('/api/v1/white-label', whiteLabelRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/staging', stagingRoutes);
app.use('/api/v1/incremental-backup', incrementalBackupRoutes);
app.use('/api/v1/payment', paymentRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.APP_VERSION || '1.0.0'
    });
});

// 404 Handler für nicht existierende Routes
app.use(notFoundHandler);

// Sentry Error Handler (vor dem eigenen Error Handler)
app.use(sentryErrorHandler());

// Error Handler
app.use(errorHandler);

// Socket.io Connection Handler
io.on('connection', (socket) => {
    logger.debug('WebSocket client connected', { socketId: socket.id });
    
    socket.on('join_user_room', (userId) => {
        socket.join(`user_${userId}`);
        logger.debug('User joined room', { userId, socketId: socket.id });
    });
    
    socket.on('disconnect', () => {
        logger.debug('WebSocket client disconnected', { socketId: socket.id });
    });
});

// Initialize Services
async function initializeServices() {
    try {
        logger.info('Initializing services...');
        await initializeDatabase();
        logger.info('Database initialized');
        await initializeRedis();
        logger.info('Redis initialized');
        await startBackgroundJobs();
        logger.info('Background jobs started');
        logger.info('All services initialized successfully');
    } catch (error) {
        logger.error('Service initialization failed', { 
            error: error.message, 
            stack: error.stack 
        });
        process.exit(1);
    }
}

// Graceful Shutdown
const gracefulShutdown = (signal) => {
    logger.info(`${signal} received, shutting down gracefully...`);
    
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });

    // Force close nach 10 Sekunden
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled Errors abfangen
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason: String(reason) });
});

// Start Server
initializeServices().then(() => {
    server.listen(PORT, () => {
        logger.info(`WPMA API Server running on port ${PORT}`, {
            port: PORT,
            nodeEnv: process.env.NODE_ENV
        });
    });
});

module.exports = app; 
