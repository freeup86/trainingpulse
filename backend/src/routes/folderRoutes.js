const express = require('express');
const { body, param, query } = require('express-validator');
const asyncHandler = require('../middleware/asyncHandler');
const { validateRequest } = require('../middleware/validateRequest');
const folderController = require('../controllers/folderController');

const router = express.Router();

// Get all folders in a program
router.get('/',
  query('programId').isUUID().withMessage('Valid program ID is required'),
  validateRequest,
  asyncHandler(folderController.getFolders)
);

// Get single folder with lists
router.get('/:id',
  param('id').isUUID().withMessage('Valid folder ID is required'),
  validateRequest,
  asyncHandler(folderController.getFolder)
);

// Create new folder
router.post('/',
  body('name').notEmpty().withMessage('Folder name is required'),
  body('programId').isUUID().withMessage('Valid program ID is required'),
  body('description').optional().custom((value) => {
    if (value === null || value === undefined) return true; // Allow null/undefined values
    return typeof value === 'string';
  }).withMessage('Description must be a string or null'),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Color must be a valid hex color'),
  body('position').optional().isInt({ min: 0 }).withMessage('Position must be a non-negative integer'),
  validateRequest,
  asyncHandler(folderController.createFolder)
);

// Update folder
router.put('/:id',
  param('id').isUUID().withMessage('Valid folder ID is required'),
  body('name').optional().notEmpty().withMessage('Folder name cannot be empty'),
  body('description').optional().isString(),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Color must be a valid hex color'),
  body('position').optional().isInt({ min: 0 }).withMessage('Position must be a non-negative integer'),
  body('is_collapsed').optional().isBoolean().withMessage('is_collapsed must be a boolean'),
  validateRequest,
  asyncHandler(folderController.updateFolder)
);

// Delete folder
router.delete('/:id',
  param('id').isUUID().withMessage('Valid folder ID is required'),
  validateRequest,
  asyncHandler(folderController.deleteFolder)
);

// Reorder folders within a program
router.post('/reorder',
  body('programId').isUUID().withMessage('Valid program ID is required'),
  body('folder_orders').isArray().withMessage('folder_orders must be an array'),
  body('folder_orders.*.id').isUUID().withMessage('Each folder order must have a valid UUID'),
  body('folder_orders.*.position').isInt({ min: 0 }).withMessage('Each position must be a non-negative integer'),
  validateRequest,
  asyncHandler(folderController.reorderFolders)
);

module.exports = router;