const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const errorHandler = (error, req, res, next) => {
  // Generate unique error ID for tracking
  const errorId = uuidv4();
  
  // Default error response
  let statusCode = 500;
  let errorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId: errorId
    }
  };
  
  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    errorResponse.error.code = 'VALIDATION_ERROR';
    errorResponse.error.message = 'Invalid input data';
    
    // Include validation details if available
    if (error.details) {
      errorResponse.error.details = error.details.map(detail => ({
        field: detail.path?.join('.') || detail.context?.key,
        message: detail.message
      }));
    }
  }
  
  else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorResponse.error.code = 'AUTHENTICATION_ERROR';
    errorResponse.error.message = 'Invalid authentication token';
  }
  
  else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    errorResponse.error.code = 'AUTHENTICATION_ERROR';
    errorResponse.error.message = 'Authentication token has expired';
  }
  
  else if (error.code === '23505') { // PostgreSQL unique violation
    statusCode = 409;
    errorResponse.error.code = 'CONFLICT';
    errorResponse.error.message = 'Resource already exists';
    
    // Extract field name from constraint name if possible
    if (error.constraint) {
      const field = error.constraint.replace(/.*_(.+)_key$/, '$1');
      errorResponse.error.details = [{
        field: field,
        message: `${field} already exists`
      }];
    }
  }
  
  else if (error.code === '23503') { // PostgreSQL foreign key violation
    statusCode = 400;
    errorResponse.error.code = 'VALIDATION_ERROR';
    errorResponse.error.message = 'Referenced resource does not exist';
  }
  
  else if (error.code === '23514') { // PostgreSQL check constraint violation
    statusCode = 400;
    errorResponse.error.code = 'VALIDATION_ERROR';
    errorResponse.error.message = 'Data violates business rules';
  }
  
  else if (error.code === '42703') { // PostgreSQL undefined column
    statusCode = 400;
    errorResponse.error.code = 'VALIDATION_ERROR';
    errorResponse.error.message = 'Invalid field specified';
  }
  
  else if (error.status || error.statusCode) {
    statusCode = error.status || error.statusCode;
    
    if (statusCode === 400) {
      errorResponse.error.code = 'VALIDATION_ERROR';
      errorResponse.error.message = error.message || 'Invalid request data';
    } else if (statusCode === 401) {
      errorResponse.error.code = 'AUTHENTICATION_ERROR';
      errorResponse.error.message = error.message || 'Authentication required';
    } else if (statusCode === 403) {
      errorResponse.error.code = 'AUTHORIZATION_ERROR';
      errorResponse.error.message = error.message || 'Access denied';
    } else if (statusCode === 404) {
      errorResponse.error.code = 'NOT_FOUND';
      errorResponse.error.message = error.message || 'Resource not found';
    } else if (statusCode === 409) {
      errorResponse.error.code = 'CONFLICT';
      errorResponse.error.message = error.message || 'Resource conflict';
    } else if (statusCode === 429) {
      errorResponse.error.code = 'RATE_LIMIT_EXCEEDED';
      errorResponse.error.message = error.message || 'Too many requests';
    }
  }
  
  // Handle custom application errors
  if (error.code && error.code.startsWith('TP_')) {
    statusCode = error.statusCode || 400;
    errorResponse.error.code = error.code;
    errorResponse.error.message = error.message;
    
    if (error.details) {
      errorResponse.error.details = error.details;
    }
  }
  
  // Log error with context
  const logContext = {
    errorId,
    statusCode,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    body: req.method !== 'GET' ? req.body : undefined,
    params: req.params,
    query: req.query
  };
  
  if (statusCode >= 500) {
    // Server errors - log with full stack trace
    logger.error('Server error occurred', {
      ...logContext,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...error
      }
    });
  } else if (statusCode >= 400) {
    // Client errors - log as warning
    logger.warn('Client error occurred', {
      ...logContext,
      error: {
        name: error.name,
        message: error.message
      }
    });
  }
  
  // Remove sensitive information in production
  if (process.env.NODE_ENV === 'production') {
    // Don't expose internal error details in production
    if (statusCode >= 500) {
      errorResponse.error.message = 'An unexpected error occurred';
    }
    
    // Remove stack traces and internal details
    delete errorResponse.error.stack;
    delete errorResponse.error.details;
  } else {
    // In development, include more error details
    if (error.stack) {
      errorResponse.error.stack = error.stack;
    }
  }
  
  // Set security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  });
  
  res.status(statusCode).json(errorResponse);
};

// Async error wrapper for route handlers
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode, code, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
  }
}

module.exports = {
  errorHandler,
  asyncHandler,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError
};