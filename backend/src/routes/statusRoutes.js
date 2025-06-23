const express = require('express');
const router = express.Router();
const statusController = require('../controllers/statusController');
const { authorize } = require('../middleware/authorize');

// All status routes require authentication (handled by app.js)
// Admin-only routes for managing statuses
router.get('/', statusController.getAllStatuses);
router.get('/:id', statusController.getStatusById);
router.post('/', authorize(['admin']), statusController.createStatus);
router.put('/:id', authorize(['admin']), statusController.updateStatus);
router.delete('/:id', authorize(['admin']), statusController.deleteStatus);

module.exports = router;