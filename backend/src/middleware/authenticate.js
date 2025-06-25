const jwt = require('jsonwebtoken');
const { isTokenBlacklisted } = require('../config/redis');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const authenticate = async (req, res, next) => {
  try {
    
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'No token provided'
        }
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Check if token is blacklisted
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      logger.logSecurityEvent('BLACKLISTED_TOKEN_USED', {
        token: token.substring(0, 20) + '...',
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Token has been revoked'
        }
      });
    }
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get fresh user data from database
    const userResult = await query(
      'SELECT id, email, name, role, team_id, active, daily_capacity_hours, skills, notification_preferences, ui_preferences, timezone, last_login FROM users WHERE id = $1',
      [decoded.userId]
    );
    
    if (userResult.rows.length === 0) {
      logger.logSecurityEvent('INVALID_USER_TOKEN', {
        userId: decoded.userId,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'User not found'
        }
      });
    }
    
    const user = userResult.rows[0];
    
    // Check if user is active
    if (!user.active) {
      logger.logSecurityEvent('INACTIVE_USER_ACCESS', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'User account is inactive'
        }
      });
    }
    
    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp <= now) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Token has expired'
        }
      });
    }
    
    // Add user data to request object
    req.user = user;
    req.token = token;
    req.tokenPayload = decoded;
    
    // Log successful authentication
    logger.debug('User authenticated successfully', {
      userId: user.id,
      email: user.email,
      role: user.role,
      ip: req.ip
    });
    
    next();
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      logger.logSecurityEvent('INVALID_JWT_TOKEN', {
        error: error.message,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Invalid token'
        }
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Token has expired'
        }
      });
    }
    
    logger.logError(error, {
      context: 'Authentication middleware',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication failed'
      }
    });
  }
};

// Role-based authorization middleware
const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required'
        }
      });
    }
    
    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      logger.logSecurityEvent('UNAUTHORIZED_ACCESS_ATTEMPT', {
        userId: req.user.id,
        email: req.user.email,
        role: req.user.role,
        requiredRoles: allowedRoles,
        endpoint: req.originalUrl,
        method: req.method,
        ip: req.ip
      });
      
      return res.status(403).json({
        success: false,
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: 'Insufficient permissions'
        }
      });
    }
    
    next();
  };
};

// Resource-based authorization middleware
const authorizeResource = (resourceType) => {
  return async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;
      
      // Admin users have access to all resources
      if (userRole === 'admin') {
        return next();
      }
      
      // Check resource-specific permissions
      let hasAccess = false;
      
      switch (resourceType) {
        case 'course':
          // Check if user is assigned to the course or is a manager
          if (userRole === 'manager') {
            hasAccess = true;
          } else {
            const assignmentResult = await query(
              'SELECT 1 FROM course_assignments WHERE course_id = $1 AND user_id = $2',
              [id, userId]
            );
            hasAccess = assignmentResult.rows.length > 0;
          }
          break;
          
        case 'user':
          // Users can access their own profile, managers can access team members
          if (id == userId) {
            hasAccess = true;
          } else if (userRole === 'manager') {
            // Check if target user is in the same team
            const teamResult = await query(
              'SELECT 1 FROM users WHERE id = $1 AND team_id = (SELECT team_id FROM users WHERE id = $2)',
              [id, userId]
            );
            hasAccess = teamResult.rows.length > 0;
          }
          break;
          
        default:
          hasAccess = false;
      }
      
      if (!hasAccess) {
        logger.logSecurityEvent('UNAUTHORIZED_RESOURCE_ACCESS', {
          userId: req.user.id,
          email: req.user.email,
          role: req.user.role,
          resourceType,
          resourceId: id,
          endpoint: req.originalUrl,
          method: req.method,
          ip: req.ip
        });
        
        return res.status(403).json({
          success: false,
          error: {
            code: 'AUTHORIZATION_ERROR',
            message: 'Access denied to this resource'
          }
        });
      }
      
      next();
      
    } catch (error) {
      logger.logError(error, {
        context: 'Resource authorization middleware',
        resourceType,
        resourceId: req.params.id,
        userId: req.user.id
      });
      
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Authorization check failed'
        }
      });
    }
  };
};

module.exports = {
  authenticate,
  authorize,
  authorizeResource
};