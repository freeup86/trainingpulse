const express = require('express');
const { body, param, query } = require('express-validator');
const asyncHandler = require('../middleware/asyncHandler');
const { validateRequest } = require('../middleware/validateRequest');
const listController = require('../controllers/listController');

const router = express.Router();

// Get all lists in a folder
router.get('/',
  query('folderId').isUUID().withMessage('Valid folder ID is required'),
  validateRequest,
  asyncHandler(listController.getLists)
);

// Get single list with courses
router.get('/:id',
  param('id').isUUID().withMessage('Valid list ID is required'),
  validateRequest,
  asyncHandler(listController.getList)
);

// Create new list
router.post('/',
  body('name').notEmpty().withMessage('List name is required'),
  body('folderId').isUUID().withMessage('Valid folder ID is required'),
  body('description').optional().custom((value) => {
    if (value === null || value === undefined) return true; // Allow null/undefined values
    return typeof value === 'string';
  }).withMessage('Description must be a string or null'),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Color must be a valid hex color'),
  body('position').optional().isInt({ min: 0 }).withMessage('Position must be a non-negative integer'),
  validateRequest,
  asyncHandler(listController.createList)
);

// Update list
router.put('/:id',
  param('id').isUUID().withMessage('Valid list ID is required'),
  body('name').optional().notEmpty().withMessage('List name cannot be empty'),
  body('description').optional().isString(),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Color must be a valid hex color'),
  body('position').optional().isInt({ min: 0 }).withMessage('Position must be a non-negative integer'),
  body('is_collapsed').optional().isBoolean().withMessage('is_collapsed must be a boolean'),
  validateRequest,
  asyncHandler(listController.updateList)
);

// Delete list
router.delete('/:id',
  param('id').isUUID().withMessage('Valid list ID is required'),
  validateRequest,
  asyncHandler(listController.deleteList)
);

// Reorder lists within a folder
router.post('/reorder',
  body('folderId').isUUID().withMessage('Valid folder ID is required'),
  body('list_orders').isArray().withMessage('list_orders must be an array'),
  body('list_orders.*.id').isUUID().withMessage('Each list order must have a valid UUID'),
  body('list_orders.*.position').isInt({ min: 0 }).withMessage('Each position must be a non-negative integer'),
  validateRequest,
  asyncHandler(listController.reorderLists)
);

// Move list to different folder
router.post('/:id/move',
  param('id').isUUID().withMessage('Valid list ID is required'),
  body('folderId').isUUID().withMessage('Valid destination folder ID is required'),
  body('position').optional().isInt({ min: 0 }).withMessage('Position must be a non-negative integer'),
  validateRequest,
  asyncHandler(listController.moveList)
);

module.exports = router;