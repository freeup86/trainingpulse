const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { authorizePermission } = require('../middleware/authorizePermission');

// All role routes require admin permissions
router.use(authorizePermission('admin.roles.manage'));

// GET /api/v1/roles - Get all roles
router.get('/', roleController.getAllRoles);

// GET /api/v1/roles/:id - Get single role
router.get('/:id', roleController.getRoleById);

// POST /api/v1/roles - Create new role
router.post('/', roleController.createRole);

// PUT /api/v1/roles/:id - Update role
router.put('/:id', roleController.updateRole);

// DELETE /api/v1/roles/:id - Delete role
router.delete('/:id', roleController.deleteRole);

module.exports = router;