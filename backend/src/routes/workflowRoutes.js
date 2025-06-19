const express = require('express');
const workflowController = require('../controllers/workflowController');
const { authorize } = require('../middleware/authenticate');

const router = express.Router();

// Workflow templates
router.get('/templates', workflowController.getWorkflowTemplates);
router.get('/templates/:id', workflowController.getWorkflowTemplateById);
router.post('/templates', authorize(['admin', 'manager']), workflowController.createWorkflowTemplate);

// Workflow instances
router.get('/instances', workflowController.getWorkflowInstances);
router.get('/instances/:courseId', workflowController.getWorkflowInstance);
router.post('/instances/:courseId', authorize(['admin', 'manager']), workflowController.createWorkflowInstance);
router.put('/instances/:instanceId', authorize(['admin', 'manager']), workflowController.updateWorkflowInstance);

// Workflow transitions
router.post('/instances/:instanceId/transition', workflowController.transitionWorkflow);

module.exports = router;