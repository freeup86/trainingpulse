const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * Get current user's permissions
 * This endpoint allows any authenticated user to see their own permissions
 */
exports.getCurrentUserPermissions = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const query = `
      SELECT DISTINCT p.name, p.display_name, p.category
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      INNER JOIN roles r ON rp.role_id = r.id
      WHERE r.name = $1 AND r.is_active = true AND p.is_active = true
      ORDER BY p.category, p.name;
    `;
    
    const result = await pool.query(query, [req.user.role]);
    
    res.json({
      success: true,
      data: {
        user: {
          id: req.user.id,
          role: req.user.role,
          permissions: result.rows
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching user permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user permissions'
    });
  }
};

/**
 * Get current user's role information with permissions
 */
exports.getCurrentUserRole = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const query = `
      SELECT 
        r.id,
        r.name,
        r.display_name,
        r.description,
        COALESCE(
          JSON_AGG(
            CASE WHEN p.id IS NOT NULL THEN
              JSON_BUILD_OBJECT(
                'id', p.id,
                'name', p.name,
                'display_name', p.display_name,
                'category', p.category
              )
            END
          ) FILTER (WHERE p.id IS NOT NULL), 
          '[]'
        ) as permissions
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN permissions p ON rp.permission_id = p.id AND p.is_active = true
      WHERE r.name = $1 AND r.is_active = true
      GROUP BY r.id, r.name, r.display_name, r.description;
    `;
    
    const result = await pool.query(query, [req.user.role]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User role not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error fetching user role:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user role'
    });
  }
};