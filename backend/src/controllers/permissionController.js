const pool = require('../config/database');
const logger = require('../utils/logger');

// Get all permissions
exports.getAllPermissions = async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        name,
        display_name,
        description,
        category,
        is_active,
        created_at,
        updated_at
      FROM permissions 
      WHERE is_active = true
      ORDER BY category, display_name;
    `;

    const result = await pool.query(query);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch permissions'
    });
  }
};

// Get permissions grouped by category
exports.getPermissionsByCategory = async (req, res) => {
  try {
    const query = `
      SELECT 
        category,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', id,
            'name', name,
            'display_name', display_name,
            'description', description
          ) ORDER BY display_name
        ) as permissions
      FROM permissions 
      WHERE is_active = true
      GROUP BY category
      ORDER BY category;
    `;

    const result = await pool.query(query);
    
    // Transform the result into a more usable format
    const groupedPermissions = {};
    result.rows.forEach(row => {
      groupedPermissions[row.category] = row.permissions;
    });
    
    res.json({
      success: true,
      data: groupedPermissions
    });
  } catch (error) {
    logger.error('Error fetching grouped permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch grouped permissions'
    });
  }
};

// Get single permission by ID
exports.getPermissionById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT id, name, display_name, description, category, is_active, created_at, updated_at
       FROM permissions 
       WHERE id = $1 AND is_active = true`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Permission not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error fetching permission:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch permission'
    });
  }
};

// Create new permission
exports.createPermission = async (req, res) => {
  try {
    const { name, display_name, description, category } = req.body;
    
    // Validate required fields
    if (!name || !display_name || !category) {
      return res.status(400).json({
        success: false,
        error: 'Name, display name, and category are required'
      });
    }

    // Check if permission name already exists
    const existingPermission = await pool.query(
      'SELECT id FROM permissions WHERE name = $1',
      [name]
    );

    if (existingPermission.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Permission name already exists'
      });
    }

    const result = await pool.query(
      `INSERT INTO permissions (name, display_name, description, category) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name, display_name, description, category, is_active, created_at, updated_at`,
      [name, display_name, description, category]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error creating permission:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create permission'
    });
  }
};

// Update permission
exports.updatePermission = async (req, res) => {
  try {
    const { id } = req.params;
    const { display_name, description, category } = req.body;
    
    const result = await pool.query(
      `UPDATE permissions 
       SET display_name = $1, description = $2, category = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND is_active = true
       RETURNING id, name, display_name, description, category, is_active, created_at, updated_at`,
      [display_name, description, category, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Permission not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error updating permission:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update permission'
    });
  }
};

// Delete permission (soft delete)
exports.deletePermission = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if permission is being used by any roles
    const rolesUsingPermission = await pool.query(
      'SELECT COUNT(*) as count FROM role_permissions WHERE permission_id = $1',
      [id]
    );

    if (parseInt(rolesUsingPermission.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete permission that is assigned to roles'
      });
    }

    const result = await pool.query(
      `UPDATE permissions 
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND is_active = true
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Permission not found'
      });
    }

    res.json({
      success: true,
      message: 'Permission deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting permission:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete permission'
    });
  }
};

// Get available categories
exports.getCategories = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT category 
       FROM permissions 
       WHERE is_active = true 
       ORDER BY category`
    );
    
    res.json({
      success: true,
      data: result.rows.map(row => row.category)
    });
  } catch (error) {
    logger.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
};