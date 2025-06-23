const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * Permission-based authorization middleware
 * @param {string|string[]} requiredPermissions - Permission(s) required to access the resource
 * @returns {Function} Express middleware function
 */
function authorizePermission(requiredPermissions) {
  // Ensure requiredPermissions is an array
  const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
  
  return async (req, res, next) => {
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

      // Get user's permissions from database
      const userPermissions = await getUserPermissions(req.user.role);
      
      // Check if user has all required permissions
      const hasAllPermissions = permissions.every(permission => 
        userPermissions.includes(permission)
      );

      if (!hasAllPermissions) {
        logger.logSecurityEvent('AUTHORIZATION_FAILED', {
          reason: 'Insufficient permissions',
          userId: req.user.id,
          userRole: req.user.role,
          userPermissions: userPermissions,
          requiredPermissions: permissions,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.originalUrl
        });
        
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions to access this resource'
          }
        });
      }

      // Log successful authorization
      logger.debug('Permission authorization successful', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredPermissions: permissions,
        endpoint: req.originalUrl
      });

      // Attach user permissions to request for potential use in controllers
      req.userPermissions = userPermissions;
      next();
    } catch (error) {
      logger.error('Permission authorization middleware error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Permission check failed'
        }
      });
    }
  };
}

/**
 * Get user permissions from database based on their role
 * @param {string} roleName - The user's role name
 * @returns {Promise<string[]>} Array of permission names
 */
async function getUserPermissions(roleName) {
  try {
    const query = `
      SELECT DISTINCT p.name
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      INNER JOIN roles r ON rp.role_id = r.id
      WHERE r.name = $1 AND r.is_active = true AND p.is_active = true
      ORDER BY p.name;
    `;
    
    const result = await pool.query(query, [roleName]);
    return result.rows.map(row => row.name);
  } catch (error) {
    logger.error('Error fetching user permissions:', error);
    throw error;
  }
}

/**
 * Resource ownership authorization with permission check
 * Checks if the authenticated user owns the resource or has override permission
 * @param {string} resourceUserIdField - Field name containing the user ID (e.g., 'user_id', 'created_by')
 * @param {string} overridePermission - Permission that allows access to any resource
 * @returns {Function} Express middleware function
 */
function authorizeResourceAccess(resourceUserIdField = 'user_id', overridePermission = 'admin.override') {
  return async (req, res, next) => {
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

      // Get user's permissions
      const userPermissions = await getUserPermissions(req.user.role);
      
      // Check if user has override permission (like admin access)
      if (userPermissions.includes(overridePermission)) {
        req.userPermissions = userPermissions;
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

      req.userPermissions = userPermissions;
      next();
    } catch (error) {
      logger.error('Resource access authorization middleware error:', error);
      
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
 * Team-based authorization with permission check
 * Checks if the authenticated user belongs to the specified team or has override permission
 * @param {string} teamIdSource - Source of team ID ('params', 'body', 'query', or a custom function)
 * @param {string} overridePermission - Permission that allows access to any team
 * @returns {Function} Express middleware function
 */
function authorizeTeamPermission(teamIdSource = 'params', overridePermission = 'admin.override') {
  return async (req, res, next) => {
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

      // Get user's permissions
      const userPermissions = await getUserPermissions(req.user.role);
      
      // Check if user has override permission
      if (userPermissions.includes(overridePermission)) {
        req.userPermissions = userPermissions;
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

      req.userPermissions = userPermissions;
      next();
    } catch (error) {
      logger.error('Team permission authorization middleware error:', error);
      
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

/**
 * Utility function to check if user has specific permission
 * @param {string} roleName - User's role name
 * @param {string} permission - Permission to check
 * @returns {Promise<boolean>} Whether user has the permission
 */
async function hasPermission(roleName, permission) {
  try {
    const userPermissions = await getUserPermissions(roleName);
    return userPermissions.includes(permission);
  } catch (error) {
    logger.error('Error checking permission:', error);
    return false;
  }
}

module.exports = {
  authorizePermission,
  authorizeResourceAccess,
  authorizeTeamPermission,
  getUserPermissions,
  hasPermission
};