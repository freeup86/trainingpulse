const express = require('express');
const userController = require('../controllers/userController');
const { authorize } = require('../middleware/authenticate');

const router = express.Router();

// Current user endpoints
router.get('/current', userController.getCurrentUser);
router.put('/current', userController.updateUser);

// User management endpoints
router.get('/', userController.getUsers);
router.get('/:id', userController.getUserById);
router.post('/', authorize(['admin']), userController.createUser);
router.put('/:id', authorize(['admin']), userController.updateUser);
router.delete('/:id', authorize(['admin']), userController.deleteUser);

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