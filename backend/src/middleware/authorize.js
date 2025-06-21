const logger = require('../utils/logger');

/**
 * Role-based authorization middleware
 * @param {string|string[]} allowedRoles - Role(s) allowed to access the resource
 * @returns {Function} Express middleware function
 */
function authorize(allowedRoles) {
  // Ensure allowedRoles is an array
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        logger.logSecurityEvent('AUTHORIZATION_FAILED', {
          reason: 'User not authenticated',
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.originalUrl
        });
        
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      // Check if user has required role
      if (!roles.includes(req.user.role)) {
        logger.logSecurityEvent('AUTHORIZATION_FAILED', {
          reason: 'Insufficient privileges',
          userId: req.user.id,
          userRole: req.user.role,
          requiredRoles: roles,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.originalUrl
        });
        
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient privileges to access this resource'
          }
        });
      }

      // Log successful authorization
      logger.debug('Authorization successful', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        endpoint: req.originalUrl
      });

      next();
    } catch (error) {
      logger.error('Authorization middleware error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Authorization check failed'
        }
      });
    }
  };
}

/**
 * Resource ownership authorization middleware
 * Checks if the authenticated user owns the resource or has admin privileges
 * @param {string} resourceUserIdField - Field name containing the user ID (e.g., 'user_id', 'created_by')
 * @returns {Function} Express middleware function
 */
function authorizeOwnership(resourceUserIdField = 'user_id') {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      // Admin users can access any resource
      if (req.user.role === 'admin') {
        return next();
      }

      // Check if resource belongs to the user
      const resourceUserId = req.resource && req.resource[resourceUserIdField];
      
      if (!resourceUserId) {
        logger.warn('Resource ownership check failed - no resource found', {
          userId: req.user.id,
          field: resourceUserIdField,
          endpoint: req.originalUrl
        });
        
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Resource not found'
          }
        });
      }

      if (resourceUserId !== req.user.id) {
        logger.logSecurityEvent('OWNERSHIP_AUTHORIZATION_FAILED', {
          userId: req.user.id,
          resourceUserId,
          field: resourceUserIdField,
          endpoint: req.originalUrl
        });
        
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied - resource does not belong to you'
          }
        });
      }

      next();
    } catch (error) {
      logger.error('Ownership authorization middleware error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Authorization check failed'
        }
      });
    }
  };
}

/**
 * Team-based authorization middleware
 * Checks if the authenticated user belongs to the specified team or has admin privileges
 * @param {string} teamIdSource - Source of team ID ('params', 'body', 'query', or a custom function)
 * @returns {Function} Express middleware function
 */
function authorizeTeamAccess(teamIdSource = 'params') {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      // Admin users can access any team
      if (req.user.role === 'admin') {
        return next();
      }

      let teamId;
      
      // Extract team ID based on source
      if (typeof teamIdSource === 'function') {
        teamId = teamIdSource(req);
      } else {
        switch (teamIdSource) {
          case 'params':
            teamId = req.params.id || req.params.teamId;
            break;
          case 'body':
            teamId = req.body.teamId;
            break;
          case 'query':
            teamId = req.query.teamId;
            break;
          default:
            teamId = req.params.id;
        }
      }

      // Check if user belongs to the team
      if (!req.user.team_id || req.user.team_id !== parseInt(teamId)) {
        logger.logSecurityEvent('TEAM_AUTHORIZATION_FAILED', {
          userId: req.user.id,
          userTeamId: req.user.team_id,
          requestedTeamId: teamId,
          endpoint: req.originalUrl
        });
        
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied - you do not belong to this team'
          }
        });
      }

      next();
    } catch (error) {
      logger.error('Team authorization middleware error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Team authorization check failed'
        }
      });
    }
  };
}

module.exports = {
  authorize,
  authorizeOwnership,
  authorizeTeamAccess
};