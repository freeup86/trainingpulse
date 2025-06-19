const express = require('express');
const notificationController = require('../controllers/notificationController');
const { authorize } = require('../middleware/authenticate');

const router = express.Router();

// Notification digest and lists
router.get('/digest', notificationController.getDigest);
router.get('/', notificationController.getNotifications);
router.get('/stats', notificationController.getStats);

// Notification management
router.put('/:id/read', notificationController.markAsRead);
router.put('/read-all', notificationController.markAllAsRead);
router.delete('/:id', notificationController.deleteNotification);

// Notification preferences
router.get('/preferences', notificationController.getPreferences);
router.put('/preferences', notificationController.updatePreferences);

// Admin operations
router.post('/test', authorize(['admin']), notificationController.sendTestNotification);
router.post('/cleanup', authorize(['admin']), notificationController.cleanupNotifications);

module.exports = router;