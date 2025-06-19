const Joi = require('joi');
const NotificationService = require('../services/NotificationService');
const { query } = require('../config/database');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Validation schemas
const notificationPreferencesSchema = Joi.object({
  email: Joi.boolean().default(true),
  inApp: Joi.boolean().default(true),
  digest: Joi.string().valid('immediate', 'hourly', 'daily', 'weekly').default('daily'),
  urgentOnly: Joi.boolean().default(false),
  categories: Joi.object({
    course_overdue: Joi.boolean().default(true),
    review_requested: Joi.boolean().default(true),
    workflow_transition: Joi.boolean().default(true),
    assignment_created: Joi.boolean().default(true),
    deadline_approaching: Joi.boolean().default(true),
    bottleneck_detected: Joi.boolean().default(true),
    bulk_operation_complete: Joi.boolean().default(false),
    status_change: Joi.boolean().default(false),
    dependency_conflict: Joi.boolean().default(true)
  }).default({})
});

const digestOptionsSchema = Joi.object({
  maxAge: Joi.number().integer().min(1).max(168).default(24), // max 1 week
  includeRead: Joi.boolean().default(false),
  digestType: Joi.string().valid('immediate', 'hourly', 'daily', 'weekly').default('daily')
});

class NotificationController {
  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * GET /notifications/digest - Get notification digest
   */
  getDigest = asyncHandler(async (req, res) => {
    // Validate query parameters
    const { error, value } = digestOptionsSchema.validate(req.query);
    if (error) {
      throw new ValidationError('Invalid digest parameters', error.details);
    }

    const { maxAge, includeRead, digestType } = value;

    const digest = await this.notificationService.generateDigest(req.user.id, {
      maxAge,
      includeRead,
      digestType
    });

    logger.info('Notification digest generated', {
      userId: req.user.id,
      totalNotifications: digest.metrics.totalNotifications,
      unreadCount: digest.metrics.unreadCount,
      digestType
    });

    res.json({
      success: true,
      data: digest
    });
  });

  /**
   * GET /notifications - Get user notifications with pagination
   */
  getNotifications = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      unreadOnly = false,
      type = null,
      priority = null
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    let whereClause = 'WHERE n.user_id = $1';
    const params = [req.user.id];
    let paramCount = 1;

    if (unreadOnly === 'true') {
      whereClause += ' AND n.read_at IS NULL';
    }

    if (type) {
      whereClause += ` AND n.type = $${++paramCount}`;
      params.push(type);
    }

    if (priority) {
      whereClause += ` AND n.priority = $${++paramCount}`;
      params.push(priority);
    }

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM notifications n
      ${whereClause}
    `, params);

    const total = parseInt(countResult.rows[0].total);
    const pages = Math.ceil(total / parseInt(limit));

    // Get notifications
    const notificationsResult = await query(`
      SELECT 
        n.*,
        fu.name as from_user_name,
        fu.email as from_user_email
      FROM notifications n
      LEFT JOIN users fu ON n.from_user_id = fu.id
      ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `, [...params, parseInt(limit), offset]);

    const notifications = notificationsResult.rows.map(notification => ({
      id: notification.id,
      type: notification.type,
      priority: notification.priority,
      title: notification.title,
      message: notification.message,
      relatedEntityType: notification.related_entity_type,
      relatedEntityId: notification.related_entity_id,
      fromUser: notification.from_user_name,
      fromUserEmail: notification.from_user_email,
      actionUrl: notification.action_url,
      actionData: notification.action_data,
      sentChannels: notification.sent_channels,
      isRead: !!notification.read_at,
      readAt: notification.read_at,
      createdAt: notification.created_at
    }));

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages,
          hasMore: parseInt(page) < pages
        }
      }
    });
  });

  /**
   * PUT /notifications/:id/read - Mark notification as read
   */
  markAsRead = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await this.notificationService.markAsRead(parseInt(id), req.user.id);

    if (result.success) {
      logger.debug('Notification marked as read', {
        notificationId: id,
        userId: req.user.id
      });
    }

    res.json({
      success: result.success,
      data: {
        message: result.message
      }
    });
  });

  /**
   * PUT /notifications/read-all - Mark all notifications as read
   */
  markAllAsRead = asyncHandler(async (req, res) => {
    const result = await this.notificationService.markAllAsRead(req.user.id);

    logger.info('All notifications marked as read', {
      userId: req.user.id,
      updatedCount: result.updatedCount
    });

    res.json({
      success: true,
      data: result
    });
  });

  /**
   * GET /notifications/preferences - Get user notification preferences
   */
  getPreferences = asyncHandler(async (req, res) => {
    const preferences = await this.notificationService.getUserNotificationPreferences(req.user.id);

    res.json({
      success: true,
      data: {
        preferences
      }
    });
  });

  /**
   * PUT /notifications/preferences - Update user notification preferences
   */
  updatePreferences = asyncHandler(async (req, res) => {
    // Validate input
    const { error, value } = notificationPreferencesSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid notification preferences', error.details);
    }

    const updatedPreferences = await this.notificationService.updateNotificationPreferences(
      req.user.id,
      value
    );

    logger.info('Notification preferences updated', {
      userId: req.user.id,
      preferences: value
    });

    res.json({
      success: true,
      data: {
        preferences: updatedPreferences,
        message: 'Preferences updated successfully'
      }
    });
  });

  /**
   * GET /notifications/stats - Get notification statistics
   */
  getStats = asyncHandler(async (req, res) => {
    const { days = 30 } = req.query;

    const statsResult = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN read_at IS NULL THEN 1 END) as unread,
        COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 day' THEN 1 END) as today,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as this_week
      FROM notifications 
      WHERE user_id = $1 
        AND created_at > NOW() - INTERVAL '${parseInt(days)} days'
    `, [req.user.id]);

    const typeStatsResult = await query(`
      SELECT 
        type,
        COUNT(*) as count,
        COUNT(CASE WHEN read_at IS NULL THEN 1 END) as unread_count
      FROM notifications 
      WHERE user_id = $1 
        AND created_at > NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY type
      ORDER BY count DESC
    `, [req.user.id]);

    const stats = statsResult.rows[0];
    const typeStats = typeStatsResult.rows;

    res.json({
      success: true,
      data: {
        overview: {
          total: parseInt(stats.total),
          unread: parseInt(stats.unread),
          urgent: parseInt(stats.urgent),
          highPriority: parseInt(stats.high_priority),
          today: parseInt(stats.today),
          thisWeek: parseInt(stats.this_week)
        },
        byType: typeStats.map(row => ({
          type: row.type,
          total: parseInt(row.count),
          unread: parseInt(row.unread_count)
        })),
        period: `${days} days`
      }
    });
  });

  /**
   * POST /notifications/test - Send test notification (dev/admin only)
   */
  sendTestNotification = asyncHandler(async (req, res) => {
    // Only allow admins to send test notifications
    if (req.user.role !== 'admin') {
      throw new ValidationError('Only administrators can send test notifications');
    }

    const {
      targetUserId = req.user.id,
      type = 'test_notification',
      priority = 'normal',
      title = 'Test Notification',
      message = 'This is a test notification from TrainingPulse'
    } = req.body;

    const notification = await this.notificationService.createNotification({
      userId: targetUserId,
      type,
      priority,
      title,
      message,
      fromUserId: req.user.id
    }, {
      deliverImmediately: true
    });

    logger.info('Test notification sent', {
      sentBy: req.user.id,
      targetUserId,
      notificationId: notification?.id
    });

    res.json({
      success: true,
      data: {
        notification,
        message: 'Test notification sent successfully'
      }
    });
  });

  /**
   * DELETE /notifications/:id - Delete notification
   */
  deleteNotification = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await query(`
      DELETE FROM notifications 
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `, [parseInt(id), req.user.id]);

    if (result.rows.length === 0) {
      throw new ValidationError('Notification not found or access denied');
    }

    logger.debug('Notification deleted', {
      notificationId: id,
      userId: req.user.id
    });

    res.json({
      success: true,
      data: {
        message: 'Notification deleted successfully'
      }
    });
  });

  /**
   * POST /notifications/cleanup - Clean up old notifications
   */
  cleanupNotifications = asyncHandler(async (req, res) => {
    // Only allow admins to run cleanup
    if (req.user.role !== 'admin') {
      throw new ValidationError('Only administrators can run cleanup operations');
    }

    const { daysToKeep = 30 } = req.body;

    const deletedCount = await this.notificationService.cleanupOldNotifications(daysToKeep);

    logger.info('Notification cleanup completed', {
      deletedCount,
      daysToKeep,
      runBy: req.user.id
    });

    res.json({
      success: true,
      data: {
        deletedCount,
        daysToKeep,
        message: `Cleaned up ${deletedCount} old notifications`
      }
    });
  });
}

module.exports = new NotificationController();