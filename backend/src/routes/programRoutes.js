const express = require('express');
const router = express.Router();
const programController = require('../controllers/programController');
const { authenticate } = require('../middleware/authenticate');
const asyncHandler = require('../middleware/asyncHandler');
const { validateRequest } = require('../middleware/validateRequest');
const { body, param, query } = require('express-validator');

// All routes require authentication
router.use(authenticate);

// Validation rules
const createProgramValidation = [
  body('name').notEmpty().withMessage('Program name is required'),
  body('code').notEmpty().withMessage('Program code is required'),
  body('type').notEmpty().isIn(['program', 'client', 'department']).withMessage('Program type is required and must be program, client, or department'),
  body('status').optional().isIn(['active', 'inactive', 'archived']),
  body('color').optional().matches(/^#[0-9A-F]{6}$/i),
  body('contact_email').optional().custom((value) => {
    if (!value || value.trim() === '') return true; // Allow empty strings
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); // Validate email format if not empty
  }).withMessage('Invalid email format')
];

const updateProgramValidation = [
  param('id').isUUID(),
  body('name').optional().notEmpty(),
  body('type').optional().isIn(['program', 'client', 'department']),
  body('status').optional().isIn(['active', 'inactive', 'archived']),
  body('color').optional().matches(/^#[0-9A-F]{6}$/i),
  body('contact_email').optional().custom((value) => {
    if (!value || value.trim() === '') return true; // Allow empty strings
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); // Validate email format if not empty
  }).withMessage('Invalid email format')
];

// Routes
router.get('/', 
  asyncHandler(programController.getPrograms)
);

// Debug endpoint to test raw program data
router.get('/debug', async (req, res) => {
  try {
    const { query } = require('../config/database');
    const result = await query('SELECT id, name, code, type, owner_id, created_at FROM programs ORDER BY created_at DESC');
    const members = await query('SELECT program_id, user_id, role FROM program_members');
    
    res.json({
      success: true,
      data: {
        programs: result.rows,
        members: members.rows,
        userId: req.user.id
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id',
  param('id').isUUID(),
  validateRequest,
  asyncHandler(programController.getProgram)
);

router.post('/',
  createProgramValidation,
  validateRequest,
  asyncHandler(programController.createProgram)
);

router.put('/:id',
  updateProgramValidation,
  validateRequest,
  asyncHandler(programController.updateProgram)
);

router.delete('/:id',
  param('id').isUUID(),
  validateRequest,
  asyncHandler(programController.deleteProgram)
);

// Member management
router.post('/:id/members',
  param('id').isUUID(),
  body('user_id').isInt(),
  body('role').optional().isIn(['owner', 'admin', 'member', 'viewer']),
  validateRequest,
  asyncHandler(programController.addMember)
);

router.delete('/:id/members/:userId',
  param('id').isUUID(),
  param('userId').isInt(),
  validateRequest,
  asyncHandler(programController.removeMember)
);

// Course duplication
router.post('/courses/:courseId/duplicate',
  param('courseId').isInt(),
  body('program_id').optional().isUUID(),
  validateRequest,
  asyncHandler(programController.duplicateCourse)
);

module.exports = router;