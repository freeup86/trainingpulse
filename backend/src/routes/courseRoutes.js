const express = require('express');
const courseController = require('../controllers/courseController');
const { authorize, authorizeResource } = require('../middleware/authenticate');

const router = express.Router();

// Course CRUD operations
router.get('/', courseController.getCourses);
router.post('/', authorize(['admin', 'manager', 'designer']), courseController.createCourse);
router.get('/:id', authorizeResource('course'), courseController.getCourseById);
router.put('/:id', authorizeResource('course'), courseController.updateCourse);
router.delete('/:id', authorize(['admin', 'manager']), courseController.deleteCourse);

// Subtask operations
router.post('/:id/subtasks', authorizeResource('course'), courseController.createSubtask);
router.put('/:id/subtasks/:subtaskId', authorizeResource('course'), courseController.updateSubtask);
router.delete('/:id/subtasks/:subtaskId', authorizeResource('course'), courseController.deleteSubtask);

// Status operations
router.get('/:id/status', authorizeResource('course'), courseController.getCourseStatus);
router.post('/:id/recalculate-status', authorize(['admin', 'manager']), courseController.recalculateStatus);

// Workflow transition
router.post('/:id/transition', authorizeResource('course'), courseController.transitionWorkflow);

module.exports = router;