const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const socketIo = require('socket.io');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
if (fs.existsSync('.env')) {
  require('dotenv').config();
  console.log('✅ .env geladen');
} else {
  console.log('ℹ️ Keine .env-Datei gefunden – Docker ENV wird verwendet');
}


// Import Routes
const authRoutes = require('./routes/auth');
const sitesRoutes = require('./routes/sites');
const securityRoutes = require('./routes/security');
const backupRoutes = require('./routes/backup');
const performanceRoutes = require('./routes/performance');
const aiRoutes = require('./routes/ai');
const monitoringRoutes = require('./routes/monitoring');
const emailRecoveryRoutes = require('./routes/emailRecovery');

// Import Middleware
const { errorHandler } = require('./middleware/errorHandler');
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

        // Allow all other domains (für WordPress-Plugin-Requests)
        // Diese können von beliebigen WordPress-Installationen kommen
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 600 // Cache preflight für 10 Minuten
};

app.use(cors(corsOptions));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
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

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// Error Handler
app.use(errorHandler);

// Socket.io Connection Handler
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('join_user_room', (userId) => {
        socket.join(`user_${userId}`);
        console.log(`User ${userId} joined room`);
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Initialize Services
async function initializeServices() {
    try {
        await initializeDatabase();
        await initializeRedis();
        await startBackgroundJobs();
        console.log('All services initialized successfully');
    } catch (error) {
        console.error('Service initialization failed:', error);
        process.exit(1);
    }
}

// Start Server
initializeServices().then(() => {
    server.listen(PORT, () => {
        console.log(`WPMA API Server running on port ${PORT}`);
    });
});

module.exports = app; 
