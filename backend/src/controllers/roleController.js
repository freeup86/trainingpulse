const pool = require('../config/database');
const logger = require('../utils/logger');

// Get all roles with their permissions
exports.getAllRoles = async (req, res) => {
  try {
    const query = `
      SELECT 
        r.id,
        r.name,
        r.display_name,
        r.description,
        r.is_active,
        r.created_at,
        r.updated_at,
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
      WHERE r.is_active = true
      GROUP BY r.id, r.name, r.display_name, r.description, r.is_active, r.created_at, r.updated_at
      ORDER BY r.name;
    `;

    const result = await pool.query(query);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching roles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch roles'
    });
  }
};

// Get single role by ID
exports.getRoleById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        r.id,
        r.name,
        r.display_name,
        r.description,
        r.is_active,
        r.created_at,
        r.updated_at,
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
      WHERE r.id = $1 AND r.is_active = true
      GROUP BY r.id, r.name, r.display_name, r.description, r.is_active, r.created_at, r.updated_at;
    `;

    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Role not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error fetching role:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch role'
    });
  }
};

// Create new role
exports.createRole = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { name, display_name, description, permissions = [] } = req.body;
    
    // Validate required fields
    if (!name || !display_name) {
      return res.status(400).json({
        success: false,
        error: 'Name and display name are required'
      });
    }

    // Check if role name already exists
    const existingRole = await client.query(
      'SELECT id FROM roles WHERE name = $1',
      [name]
    );

    if (existingRole.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Role name already exists'
      });
    }

    // Create role
    const roleResult = await client.query(
      `INSERT INTO roles (name, display_name, description) 
       VALUES ($1, $2, $3) 
       RETURNING id, name, display_name, description, is_active, created_at, updated_at`,
      [name, display_name, description]
    );

    const role = roleResult.rows[0];

    // Add permissions if provided
    if (permissions.length > 0) {
      const permissionValues = permissions.map((permId, index) => 
        `($1, $${index + 2})`
      ).join(', ');
      
      const permissionQuery = `
        INSERT INTO role_permissions (role_id, permission_id) 
        VALUES ${permissionValues}
      `;
      
      await client.query(permissionQuery, [role.id, ...permissions]);
    }

    await client.query('COMMIT');
    
    // Fetch the complete role with permissions
    const completeRole = await client.query(`
      SELECT 
        r.id,
        r.name,
        r.display_name,
        r.description,
        r.is_active,
        r.created_at,
        r.updated_at,
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
      WHERE r.id = $1
      GROUP BY r.id, r.name, r.display_name, r.description, r.is_active, r.created_at, r.updated_at
    `, [role.id]);

    res.status(201).json({
      success: true,
      data: completeRole.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating role:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create role'
    });
  } finally {
    client.release();
  }
};

// Update role
exports.updateRole = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { display_name, description, permissions = [] } = req.body;
    
    // Update role basic info
    const roleResult = await client.query(
      `UPDATE roles 
       SET display_name = $1, description = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND is_active = true
       RETURNING id, name, display_name, description, is_active, created_at, updated_at`,
      [display_name, description, id]
    );

    if (roleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Role not found'
      });
    }

    // Update permissions - remove all existing and add new ones
    await client.query('DELETE FROM role_permissions WHERE role_id = $1', [id]);
    
    if (permissions.length > 0) {
      const permissionValues = permissions.map((permId, index) => 
        `($1, $${index + 2})`
      ).join(', ');
      
      const permissionQuery = `
        INSERT INTO role_permissions (role_id, permission_id) 
        VALUES ${permissionValues}
      `;
      
      await client.query(permissionQuery, [id, ...permissions]);
    }

    await client.query('COMMIT');
    
    // Fetch the complete updated role with permissions
    const completeRole = await client.query(`
      SELECT 
        r.id,
        r.name,
        r.display_name,
        r.description,
        r.is_active,
        r.created_at,
        r.updated_at,
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
      WHERE r.id = $1
      GROUP BY r.id, r.name, r.display_name, r.description, r.is_active, r.created_at, r.updated_at
    `, [id]);

    res.json({
      success: true,
      data: completeRole.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error updating role:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update role'
    });
  } finally {
    client.release();
  }
};

// Delete role (soft delete)
exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if role is being used by any users
    const usersUsingRole = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE role = (SELECT name FROM roles WHERE id = $1)',
      [id]
    );

    if (parseInt(usersUsingRole.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete role that is assigned to users'
      });
    }

    const result = await pool.query(
      `UPDATE roles 
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND is_active = true
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Role not found'
      });
    }

    res.json({
      success: true,
      message: 'Role deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting role:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete role'
    });
  }
};