const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * Express middleware to handle validation errors from express-validator
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validateRequest(req, res, next) {
  try {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      const validationErrors = errors.array().map(error => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value,
        location: error.location
      }));

      logger.warn('Validation failed', {
        endpoint: req.originalUrl,
        method: req.method,
        errors: validationErrors,
        userId: req.user?.id,
        ip: req.ip
      });

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: validationErrors
        }
      });
    }

    next();
  } catch (error) {
    logger.error('Validation middleware error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Request validation failed'
      }
    });
  }
}

/**
 * Custom validation helper for additional business logic validation
 * @param {Function} validationFunction - Custom validation function that returns true if valid, or an error message/object if invalid
 * @returns {Function} Express middleware function
 */
function customValidation(validationFunction) {
  return async (req, res, next) => {
    try {
      const validationResult = await validationFunction(req);
      
      if (validationResult === true) {
        return next();
      }

      // If validation failed, handle the error response
      const error = typeof validationResult === 'string' 
        ? { message: validationResult }
        : validationResult;

      logger.warn('Custom validation failed', {
        endpoint: req.originalUrl,
        method: req.method,
        error,
        userId: req.user?.id,
        ip: req.ip
      });

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message || 'Validation failed',
          details: error.details || undefined
        }
      });
    } catch (error) {
      logger.error('Custom validation middleware error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Custom validation failed'
        }
      });
    }
  };
}

/**
 * Sanitization middleware for common XSS prevention
 * @param {string[]} fields - Array of field names to sanitize
 * @returns {Function} Express middleware function
 */
function sanitizeInput(fields = []) {
  return (req, res, next) => {
    try {
      const sanitizeString = (str) => {
        if (typeof str !== 'string') return str;
        
        return str
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
          .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
          .replace(/javascript:/gi, '') // Remove javascript: protocol
          .replace(/on\w+\s*=/gi, '') // Remove event handlers
          .trim();
      };

      const sanitizeObject = (obj, fieldsToSanitize) => {
        if (!obj || typeof obj !== 'object') return obj;
        
        for (const field of fieldsToSanitize) {
          if (obj[field] && typeof obj[field] === 'string') {
            obj[field] = sanitizeString(obj[field]);
          }
        }
        
        return obj;
      };

      // Sanitize request body
      if (req.body && fields.length > 0) {
        req.body = sanitizeObject(req.body, fields);
      }

      // Sanitize query parameters
      if (req.query && fields.length > 0) {
        req.query = sanitizeObject(req.query, fields);
      }

      next();
    } catch (error) {
      logger.error('Input sanitization middleware error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Input sanitization failed'
        }
      });
    }
  };
}

/**
 * File upload validation middleware
 * @param {Object} options - Validation options
 * @param {string[]} options.allowedTypes - Array of allowed MIME types
 * @param {number} options.maxSize - Maximum file size in bytes
 * @param {number} options.maxFiles - Maximum number of files
 * @returns {Function} Express middleware function
 */
function validateFileUpload(options = {}) {
  const {
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    maxSize = 10 * 1024 * 1024, // 10MB default
    maxFiles = 5
  } = options;

  return (req, res, next) => {
    try {
      if (!req.files && !req.file) {
        return next(); // No files to validate
      }

      const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];
      
      // Check number of files
      if (files.length > maxFiles) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Too many files. Maximum ${maxFiles} files allowed.`
          }
        });
      }

      // Validate each file
      for (const file of files) {
        if (!file) continue;
        
        // Check file type
        if (!allowedTypes.includes(file.mimetype)) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: `Invalid file type: ${file.mimetype}. Allowed types: ${allowedTypes.join(', ')}`
            }
          });
        }

        // Check file size
        if (file.size > maxSize) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: `File too large: ${file.originalname}. Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB`
            }
          });
        }
      }

      next();
    } catch (error) {
      logger.error('File upload validation middleware error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'File validation failed'
        }
      });
    }
  };
}

module.exports = {
  validateRequest,
  customValidation,
  sanitizeInput,
  validateFileUpload
};