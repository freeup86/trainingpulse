const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissionController');
const { authorizePermission } = require('../middleware/authorizePermission');

// All permission routes require admin permissions
router.use(authorizePermission('admin.permissions.manage'));

// GET /api/v1/permissions - Get all permissions
router.get('/', permissionController.getAllPermissions);

// GET /api/v1/permissions/grouped - Get permissions grouped by category
router.get('/grouped', permissionController.getPermissionsByCategory);

// GET /api/v1/permissions/categories - Get available categories
router.get('/categories', permissionController.getCategories);

// GET /api/v1/permissions/:id - Get single permission
router.get('/:id', permissionController.getPermissionById);

// POST /api/v1/permissions - Create new permission
router.post('/', permissionController.createPermission);

// PUT /api/v1/permissions/:id - Update permission
router.put('/:id', permissionController.updatePermission);

// DELETE /api/v1/permissions/:id - Delete permission
router.delete('/:id', permissionController.deletePermission);

module.exports = router;