// Set SSL configuration for Aiven before any other requires
if (process.env.NODE_ENV === 'production' && process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import configurations
const { connectDB } = require('./config/database');
const { connectRedis } = require('./config/redis');
const logger = require('./utils/logger');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const { authenticate } = require('./middleware/authenticate');

// Import routes
const authRoutes = require('./routes/authRoutes');
const courseRoutes = require('./routes/courseRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const bulkRoutes = require('./routes/bulkRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const userRoutes = require('./routes/userRoutes');
const teamRoutes = require('./routes/teams');
const workflowRoutes = require('./routes/workflowRoutes');
const settingsRoutes = require('./routes/settings');
const statusRoutes = require('./routes/statusRoutes');
const roleRoutes = require('./routes/roleRoutes');
const phaseStatusRoutes = require('./routes/phaseStatusRoutes');
const permissionRoutes = require('./routes/permissionRoutes');
const priorityRoutes = require('./routes/priorityRoutes');
const userPermissionRoutes = require('./routes/userPermissionRoutes');
const modalityRoutes = require('./routes/modalityRoutes');
const programRoutes = require('./routes/programRoutes');
const folderRoutes = require('./routes/folderRoutes');
const listRoutes = require('./routes/listRoutes');
const timeTrackingRoutes = require('./routes/timeTrackingRoutes');
const commentsRoutes = require('./routes/commentsRoutes');
const activityRoutes = require('./routes/activityRoutes');

const app = express();
const PORT = process.env.PORT || 3001;
const API_VERSION = process.env.API_VERSION || 'v1';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 63072000,
    includeSubDomains: true,
    preload: true
  }
}));

// Manual CORS implementation for better control
app.use((req, res, next) => {
  const origin = req.headers.origin;
  console.log(`CORS request from origin: ${origin} to ${req.method} ${req.path}`);
  
  // Allow all origins in development
  if (process.env.NODE_ENV === 'development' && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  // Handle production CORS
  if (process.env.NODE_ENV === 'production') {
    const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [];
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.sendStatus(204);
  }
  
  next();
});

// General middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
if (process.env.ENABLE_REQUEST_LOGGING === 'true') {
  app.use(requestLogger);
}

// Rate limiting - more lenient for development
const publicLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (process.env.NODE_ENV === 'development' ? 10000 : 100), // Very high for dev
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authenticatedLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
  max: parseInt(process.env.AUTHENTICATED_RATE_LIMIT_MAX_REQUESTS) || (process.env.NODE_ENV === 'development' ? 10000 : 500),
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const bulkLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: parseInt(process.env.BULK_RATE_LIMIT_MAX_REQUESTS) || (process.env.NODE_ENV === 'development' ? 1000 : 10),
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many bulk requests from this IP'
    }
  }
});

const statusLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: parseInt(process.env.STATUS_RATE_LIMIT_MAX_REQUESTS) || (process.env.NODE_ENV === 'development' ? 10000 : 1000),
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many status requests from this IP'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply public rate limiter to all routes initially (but lenient in development)
if (process.env.NODE_ENV !== 'development') {
  app.use(publicLimiter);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0'
    }
  });
});


// API routes
app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/users`, authenticate, authenticatedLimiter, userRoutes);
app.use(`/api/${API_VERSION}/teams`, authenticate, authenticatedLimiter, teamRoutes);
app.use(`/api/${API_VERSION}/courses`, authenticate, authenticatedLimiter, courseRoutes);
app.use(`/api/${API_VERSION}/workflows`, authenticate, authenticatedLimiter, workflowRoutes);
app.use(`/api/${API_VERSION}/analytics`, authenticate, authenticatedLimiter, analyticsRoutes);
app.use(`/api/${API_VERSION}/bulk`, authenticate, bulkLimiter, bulkRoutes);
app.use(`/api/${API_VERSION}/notifications`, authenticate, authenticatedLimiter, notificationRoutes);
app.use(`/api/${API_VERSION}/settings`, authenticate, authenticatedLimiter, settingsRoutes);
app.use(`/api/${API_VERSION}/statuses`, authenticate, statusLimiter, statusRoutes);
app.use(`/api/${API_VERSION}/phase-statuses`, authenticate, statusLimiter, phaseStatusRoutes);
app.use(`/api/${API_VERSION}/priorities`, authenticate, statusLimiter, priorityRoutes);
app.use(`/api/${API_VERSION}/roles`, authenticate, authenticatedLimiter, roleRoutes);
app.use(`/api/${API_VERSION}/permissions`, authenticate, authenticatedLimiter, permissionRoutes);
app.use(`/api/${API_VERSION}/user-permissions`, authenticate, authenticatedLimiter, userPermissionRoutes);
app.use(`/api/${API_VERSION}/modality`, authenticate, authenticatedLimiter, modalityRoutes);
app.use(`/api/${API_VERSION}/programs`, authenticate, authenticatedLimiter, programRoutes);
app.use(`/api/${API_VERSION}/folders`, authenticate, authenticatedLimiter, folderRoutes);
app.use(`/api/${API_VERSION}/lists`, authenticate, authenticatedLimiter, listRoutes);
app.use(`/api/${API_VERSION}/time-entries`, authenticate, authenticatedLimiter, timeTrackingRoutes);
app.use(`/api/${API_VERSION}/comments`, authenticate, authenticatedLimiter, commentsRoutes);
app.use(`/api/${API_VERSION}/activities`, authenticate, authenticatedLimiter, activityRoutes);

// API documentation endpoint
app.get(`/api/${API_VERSION}`, (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'TrainingPulse API',
      version: API_VERSION,
      description: 'Specialized workflow management system for training and development teams',
      endpoints: {
        auth: `/api/${API_VERSION}/auth`,
        users: `/api/${API_VERSION}/users`,
        courses: `/api/${API_VERSION}/courses`,
        workflows: `/api/${API_VERSION}/workflows`,
        analytics: `/api/${API_VERSION}/analytics`,
        bulk: `/api/${API_VERSION}/bulk`,
        notifications: `/api/${API_VERSION}/notifications`
      },
      documentation: 'https://docs.trainingpulse.com'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
      path: req.originalUrl
    }
  });
});

// Global error handler
app.use(errorHandler);

// Graceful shutdown handler
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  if (global.server) {
    global.server.close(() => {
      logger.info('HTTP server closed');
      
      // Close database connections
      // Close Redis connections
      // Close any other resources
      
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
  
  // Force close after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

// Start server
async function startServer() {
  try {
    logger.info('Starting server initialization...');
    
    // Initialize database connection
    await connectDB();
    logger.info('Database connected successfully');
    
    // Run migrations in production
    if (process.env.NODE_ENV === 'production') {
      try {
        logger.info('Running database migrations...');
        const { runMigrations } = require('../migrations/migrate');
        await runMigrations();
        logger.info('Database migrations completed successfully');
      } catch (error) {
        logger.error('Migration failed:', error);
        // Don't exit on migration failure in production, log and continue
        logger.warn('Server starting despite migration failure - manual intervention may be required');
      }
    }
    
    // Initialize Redis connection (optional)
    try {
      const redisClient = await connectRedis();
      if (redisClient) {
        logger.info('Redis connected successfully');
      } else {
        logger.info('Redis connection skipped');
      }
    } catch (error) {
      logger.warn('Redis connection failed - running without caching:', error.message);
    }
    
    logger.info('Starting HTTP server...');
    
    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info(`TrainingPulse API Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(`API Version: ${API_VERSION}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`API documentation: http://localhost:${PORT}/api/${API_VERSION}`);
    });
    
    // Export server for graceful shutdown
    global.server = server;
    
    logger.info('Server startup completed successfully');
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
// Start server when file is executed directly
startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = app;