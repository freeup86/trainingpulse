const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Determine log level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const logLevel = process.env.LOG_LEVEL || 'info';
  
  if (env === 'development') {
    return 'debug';
  }
  
  return logLevel;
};

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  ),
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }),
  
  // Error log file
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),
  
  // Combined log file
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'combined.log'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  })
];

// Create logger instance
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
  exitOnError: false,
});

// Handle uncaught exceptions and unhandled rejections
logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'exceptions.log'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  })
);

logger.rejections.handle(
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'rejections.log'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  })
);

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Add request logging helper
logger.logRequest = (req, res, duration) => {
  const logData = {
    method: req.method,
    url: req.originalUrl,
    status: res.statusCode,
    duration: `${duration}ms`,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
  };
  
  if (res.statusCode >= 400) {
    logger.error('Request failed', logData);
  } else {
    logger.http('Request completed', logData);
  }
};

// Add database query logging helper
logger.logQuery = (query, duration, rowCount) => {
  const logData = {
    query: query.substring(0, 100), // Truncate long queries
    duration: `${duration}ms`,
    rows: rowCount
  };
  
  if (duration > 1000) {
    logger.warn('Slow query detected', logData);
  } else {
    logger.debug('Query executed', logData);
  }
};

// Add error logging helper with context
logger.logError = (error, context = {}) => {
  const logData = {
    message: error.message,
    stack: error.stack,
    ...context
  };
  
  logger.error('Application error', logData);
};

// Add security event logging
logger.logSecurityEvent = (event, details = {}) => {
  const logData = {
    event,
    timestamp: new Date().toISOString(),
    ...details
  };
  
  logger.warn('Security event', logData);
};

// Add performance monitoring
logger.logPerformance = (operation, duration, metadata = {}) => {
  const logData = {
    operation,
    duration: `${duration}ms`,
    ...metadata
  };
  
  if (duration > 5000) {
    logger.warn('Performance issue detected', logData);
  } else {
    logger.debug('Performance metric', logData);
  }
};

module.exports = logger;