const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authenticate');
const priorityController = require('../controllers/priorityController');

// All routes require authentication
router.use(authenticate);

// Get all priorities (all authenticated users can view)
router.get('/', priorityController.getAllPriorities);

// Get priority by ID (all authenticated users can view)
router.get('/:id', priorityController.getPriorityById);

// Create priority (admin only)
router.post('/', authorize(['admin']), priorityController.createPriority);

// Update priority (admin only)
router.put('/:id', authorize(['admin']), priorityController.updatePriority);

// Delete priority (admin only)
router.delete('/:id', authorize(['admin']), priorityController.deletePriority);

module.exports = router;