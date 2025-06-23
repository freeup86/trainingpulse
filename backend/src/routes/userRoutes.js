const express = require('express');
const userController = require('../controllers/userController');
const { authorize } = require('../middleware/authenticate');
const { authorizePermission } = require('../middleware/authorizePermission');

const router = express.Router();

// Current user endpoints
router.get('/current', userController.getCurrentUser);
router.put('/current', userController.updateUser);

// User management endpoints
router.get('/', authorizePermission('users.view'), userController.getUsers);
router.get('/:id', authorizePermission('users.view'), userController.getUserById);
router.post('/', authorizePermission('users.create'), userController.createUser);
router.put('/:id', authorizePermission('users.update'), userController.updateUser);
router.delete('/:id', authorizePermission('users.delete'), userController.deleteUser);

// User capacity and workload
router.put('/:id/capacity', userController.updateCapacity);
router.get('/:id/workload', userController.getUserWorkload);

// User profile endpoints
router.get('/:id/profile', userController.getUserProfile);
router.put('/:id/profile', userController.updateUserProfile);
router.get('/:id/stats', userController.getUserStats);
router.get('/:id/activity', userController.getUserActivity);
router.get('/:id/courses', userController.getUserCourses);

module.exports = router;