const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');
const asyncHandler = require('../middleware/asyncHandler');

// Get all activities
router.get('/', asyncHandler(activityController.getAll));

// Get activities by program
router.get('/program/:programId', asyncHandler(activityController.getByProgram));

// Get activities by entity (course, folder, etc.)
router.get('/:entityType/:entityId', asyncHandler(activityController.getByEntity));

module.exports = router;