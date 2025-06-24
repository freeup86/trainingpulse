const express = require('express');
const phaseStatusController = require('../controllers/phaseStatusController');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

// All phase status routes require admin access
router.use(authorize(['admin']));

// CRUD operations
router.get('/', phaseStatusController.getAll);
router.get('/:id', phaseStatusController.getById);
router.post('/', phaseStatusController.create);
router.put('/:id', phaseStatusController.update);
router.delete('/:id', phaseStatusController.delete);

// Special operations
router.post('/reorder', phaseStatusController.reorder);

module.exports = router;