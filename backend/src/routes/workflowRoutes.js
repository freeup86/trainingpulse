const express = require('express');
const workflowController = require('../controllers/workflowController');
const { authorize } = require('../middleware/authenticate');

const router = express.Router();

// Workflow templates
router.get('/templates', workflowController.getWorkflowTemplates);
router.get('/templates/:id', workflowController.getWorkflowTemplateById);
router.get('/templates/:id/activity', workflowController.getWorkflowTemplateActivity);
router.post('/templates', authorize(['admin', 'manager']), workflowController.createWorkflowTemplate);

// Workflow instances
router.get('/instances', workflowController.getWorkflowInstances);
router.get('/instances/:courseId', workflowController.getWorkflowInstance);
router.post('/instances/:courseId', authorize(['admin', 'manager']), workflowController.createWorkflowInstance);
router.put('/instances/:instanceId', authorize(['admin', 'manager']), workflowController.updateWorkflowInstance);

// Workflow transitions
router.post('/instances/:instanceId/transition', workflowController.transitionWorkflow);

// Workflow designer endpoints
router.put('/templates/:id', authorize(['admin', 'manager']), workflowController.updateWorkflowTemplate);
router.delete('/templates/:id', authorize(['admin', 'manager']), workflowController.deleteWorkflowTemplate);
router.post('/templates/:id/stages', authorize(['admin', 'manager']), workflowController.addStageToTemplate);
router.put('/templates/:id/stages/:stageId', authorize(['admin', 'manager']), workflowController.updateStage);
router.delete('/templates/:id/stages/:stageId', authorize(['admin', 'manager']), workflowController.deleteStage);
router.post('/templates/:id/transitions', authorize(['admin', 'manager']), workflowController.addTransition);
router.delete('/templates/:id/transitions/:transitionId', authorize(['admin', 'manager']), workflowController.deleteTransition);

module.exports = router;