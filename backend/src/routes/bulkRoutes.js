const express = require('express');
const bulkController = require('../controllers/bulkController');
const { authorize } = require('../middleware/authenticate');

const router = express.Router();

// Bulk update operations (requires manager/admin permissions)
router.post('/preview', authorize(['admin', 'manager']), bulkController.previewBulkUpdate);
router.post('/execute', authorize(['admin', 'manager']), bulkController.executeBulkUpdate);

// Bulk operation management
router.get('/history', authorize(['admin', 'manager']), bulkController.getBulkHistory);
router.delete('/cancel/:previewId', authorize(['admin', 'manager']), bulkController.cancelBulkOperation);

// Validation and templates
router.post('/validate', authorize(['admin', 'manager']), bulkController.validateBulkCriteria);
router.get('/templates', authorize(['admin', 'manager']), bulkController.getBulkTemplates);
router.post('/template/:templateId', authorize(['admin', 'manager']), bulkController.applyBulkTemplate);

module.exports = router;