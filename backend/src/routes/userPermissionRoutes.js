const express = require('express');
const router = express.Router();
const userPermissionController = require('../controllers/userPermissionController');

// These routes only require authentication, not specific permissions
// since users should be able to see their own permissions

// GET /api/v1/user-permissions - Get current user's permissions
router.get('/', userPermissionController.getCurrentUserPermissions);

// GET /api/v1/user-permissions/role - Get current user's role with permissions
router.get('/role', userPermissionController.getCurrentUserRole);

module.exports = router;