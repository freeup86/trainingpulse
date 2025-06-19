const express = require('express');
const analyticsController = require('../controllers/analyticsController');
const { authorize, authorizeResource } = require('../middleware/authenticate');

const router = express.Router();

// Bottleneck analysis
router.get('/bottlenecks', authorize(['admin', 'manager', 'designer']), analyticsController.getBottlenecks);

// Workload analysis
router.get('/workload', authorize(['admin', 'manager']), analyticsController.getWorkload);

// Workload analysis (alias for frontend compatibility)
router.get('/workload-analysis', authorize(['admin', 'manager']), analyticsController.getWorkload);

// Impact analysis
router.get('/impact/:courseId', authorizeResource('course'), analyticsController.getImpactAnalysis);

// Course-specific bottleneck analysis
router.get('/course/:courseId/bottlenecks', authorizeResource('course'), analyticsController.getCourseBottlenecks);

// Cache management
router.post('/cache/clear', authorize(['admin', 'manager']), analyticsController.clearCache);

module.exports = router;