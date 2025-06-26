const express = require('express');
const modalityController = require('../controllers/modalityController');
const { authorize } = require('../middleware/authenticate');

const router = express.Router();

// Get all modality tasks (grouped by modality)
router.get('/tasks', modalityController.getAllModalityTasks);

// Get tasks for a specific modality
router.get('/tasks/:modality', modalityController.getModalityTasks);

// Create a new modality task (admin only)
router.post('/tasks', authorize(['admin']), modalityController.createModalityTask);

// Update a modality task (admin only)
router.put('/tasks/:id', authorize(['admin']), modalityController.updateModalityTask);

// Delete a modality task (admin only)
router.delete('/tasks/:id', authorize(['admin']), modalityController.deleteModalityTask);

// Reorder modality tasks (admin only)
router.post('/tasks/reorder', authorize(['admin']), modalityController.reorderModalityTasks);

module.exports = router;