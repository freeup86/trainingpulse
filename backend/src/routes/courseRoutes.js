const express = require('express');
const courseController = require('../controllers/courseController');
const { authorize, authorizeResource } = require('../middleware/authenticate');

const router = express.Router();

// Course CRUD operations
router.get('/', courseController.getCourses);
router.post('/', authorize(['admin', 'manager', 'designer']), courseController.createCourse);

// Deliverable and modality operations (must come before /:id routes)
router.get('/deliverables', courseController.getDeliverables);
router.get('/deliverables/:modality', courseController.getModalityDeliverables);
router.get('/modality-info/:modality', courseController.getModalityInfo);

router.get('/:id', authorizeResource('course'), courseController.getCourseById);
router.put('/:id', authorizeResource('course'), courseController.updateCourse);
router.delete('/:id', authorize(['admin', 'manager']), courseController.deleteCourse);

// Subtask operations
router.post('/:id/subtasks', authorizeResource('course'), courseController.createSubtask);
router.put('/:id/subtasks/:subtaskId', authorizeResource('course'), courseController.updateSubtask);
router.delete('/:id/subtasks/:subtaskId', authorizeResource('course'), courseController.deleteSubtask);

// Phase status history operations
router.put('/:id/subtasks/:subtaskId/phase-history/:historyId', authorizeResource('course'), courseController.updatePhaseStatusHistory);

// Status operations
router.get('/:id/status', authorizeResource('course'), courseController.getCourseStatus);
router.post('/:id/recalculate-status', authorize(['admin', 'manager']), courseController.recalculateStatus);

// Workflow transition
router.post('/:id/transition', authorizeResource('course'), courseController.transitionWorkflow);

module.exports = router;