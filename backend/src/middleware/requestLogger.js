const logger = require('../utils/logger');

const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Capture original res.end to log when response is sent
  const originalEnd = res.end;
  
  res.end = function(...args) {
    const duration = Date.now() - start;
    
    // Log request details
    logger.logRequest(req, res, duration);
    
    // Call original end method
    originalEnd.apply(this, args);
  };
  
  next();
};

module.exports = requestLogger;