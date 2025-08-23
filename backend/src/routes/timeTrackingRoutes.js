const express = require('express');
const router = express.Router();
const timeTrackingController = require('../controllers/timeTrackingController');
const { authenticate } = require('../middleware/authenticate');
const asyncHandler = require('../middleware/asyncHandler');
const { validateRequest } = require('../middleware/validateRequest');
const { body, param, query } = require('express-validator');

// All routes require authentication
router.use(authenticate);

// Validation rules
const createTimeEntryValidation = [
  body('start_time').isISO8601().withMessage('Valid start time is required'),
  body('end_time').optional().isISO8601().withMessage('End time must be valid'),
  body('duration').optional().isInt({ min: 0 }).withMessage('Duration must be a positive integer'),
  body('description').optional().isString(),
  body('is_billable').optional().isBoolean(),
  body('tags').optional().isArray()
];

const updateTimeEntryValidation = [
  param('id').isUUID(),
  body('start_time').optional().isISO8601(),
  body('end_time').optional().isISO8601(),
  body('duration').optional().isInt({ min: 0 }),
  body('description').optional().isString(),
  body('is_billable').optional().isBoolean(),
  body('tags').optional().isArray()
];

const startTrackingValidation = [
  body('task_id').optional().isInt(),
  body('course_id').optional().isInt(),
  body('description').optional().isString()
];

// Routes
router.get('/', 
  asyncHandler(timeTrackingController.getTimeEntries)
);

router.get('/:id',
  param('id').isUUID(),
  validateRequest,
  asyncHandler(timeTrackingController.getTimeEntry)
);

router.post('/',
  createTimeEntryValidation,
  validateRequest,
  asyncHandler(timeTrackingController.createTimeEntry)
);

router.put('/:id',
  updateTimeEntryValidation,
  validateRequest,
  asyncHandler(timeTrackingController.updateTimeEntry)
);

router.delete('/:id',
  param('id').isUUID(),
  validateRequest,
  asyncHandler(timeTrackingController.deleteTimeEntry)
);

// Start/stop tracking
router.post('/start',
  startTrackingValidation,
  validateRequest,
  asyncHandler(timeTrackingController.startTimeTracking)
);

router.post('/:id/stop',
  param('id').isUUID(),
  validateRequest,
  asyncHandler(timeTrackingController.stopTimeTracking)
);

// User and task specific endpoints
router.get('/user/:userId',
  param('userId').isInt(),
  validateRequest,
  asyncHandler(timeTrackingController.getTimeEntriesByUser)
);

router.get('/task/:taskId',
  param('taskId').isInt(),
  validateRequest,
  asyncHandler(timeTrackingController.getTimeEntriesByTask)
);

module.exports = router;