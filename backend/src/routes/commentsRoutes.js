const express = require('express');
const router = express.Router();
const commentsController = require('../controllers/commentsController');
const { authenticate } = require('../middleware/authenticate');
const asyncHandler = require('../middleware/asyncHandler');
const { validateRequest } = require('../middleware/validateRequest');
const { body, param } = require('express-validator');

// All routes require authentication
router.use(authenticate);

// Validation rules
const createCommentValidation = [
  body('entity_type').notEmpty().withMessage('Entity type is required'),
  body('entity_id').notEmpty().withMessage('Entity ID is required'),
  body('content').notEmpty().withMessage('Comment content is required'),
  body('parent_id').optional().isUUID(),
  body('mentions').optional().isArray(),
  body('attachments').optional().isArray()
];

const updateCommentValidation = [
  param('id').isUUID(),
  body('content').notEmpty().withMessage('Comment content is required'),
  body('mentions').optional().isArray(),
  body('attachments').optional().isArray()
];

const replyValidation = [
  param('parentId').isUUID(),
  body('content').notEmpty().withMessage('Reply content is required'),
  body('mentions').optional().isArray(),
  body('attachments').optional().isArray()
];

// Routes
router.get('/:entityType/:entityId',
  param('entityType').notEmpty(),
  param('entityId').notEmpty(),
  validateRequest,
  asyncHandler(commentsController.getCommentsByEntity)
);

router.post('/',
  createCommentValidation,
  validateRequest,
  asyncHandler(commentsController.createComment)
);

router.put('/:id',
  updateCommentValidation,
  validateRequest,
  asyncHandler(commentsController.updateComment)
);

router.delete('/:id',
  param('id').isUUID(),
  validateRequest,
  asyncHandler(commentsController.deleteComment)
);

router.post('/:parentId/reply',
  replyValidation,
  validateRequest,
  asyncHandler(commentsController.replyToComment)
);

module.exports = router;