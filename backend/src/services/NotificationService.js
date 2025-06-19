const { query, transaction } = require('../config/database');
const { publish } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Smart Notification Service
 * Handles intelligent notification aggregation, digest generation, and multi-channel delivery
 */
class NotificationService {
  constructor() {
    this.digestTypes = {
      IMMEDIATE: 'immediate',
      HOURLY: 'hourly', 
      DAILY: 'daily',
      WEEKLY: 'weekly'
    };

    this.notificationTypes = {
      COURSE_OVERDUE: 'course_overdue',
      REVIEW_REQUESTED: 'review_requested',
      WORKFLOW_TRANSITION: 'workflow_transition',
      ASSIGNMENT_CREATED: 'assignment_created',
      DEADLINE_APPROACHING: 'deadline_approaching',
      BOTTLENECK_DETECTED: 'bottleneck_detected',
      BULK_OPERATION_COMPLETE: 'bulk_operation_complete',
      STATUS_CHANGE: 'status_change',
      DEPENDENCY_CONFLICT: 'dependency_conflict'
    };

    this.priorityLevels = {
      LOW: 'low',
      NORMAL: 'normal', 
      HIGH: 'high',
      URGENT: 'urgent'
    };
  }

  /**
   * Create a new notification
   */
  async createNotification(notificationData, options = {}) {
    try {
      const {
        userId,
        type,
        priority = this.priorityLevels.NORMAL,
        title,
        message,
        relatedEntityType = null,
        relatedEntityId = null,
        fromUserId = null,
        actionUrl = null,
        actionData = null,
        channels = ['in_app']
      } = notificationData;

      const {
        skipDuplicateCheck = false,
        deliverImmediately = false
      } = options;

      // Check for duplicate notifications if requested
      if (!skipDuplicateCheck) {
        const isDuplicate = await this.checkForDuplicate(userId, type, relatedEntityType, relatedEntityId);
        if (isDuplicate) {
          logger.debug('Skipping duplicate notification', {
            userId,
            type,
            relatedEntityType,
            relatedEntityId
          });
          return null;
        }
      }

      const notification = await transaction(async (client) => {
        // Create the notification
        const result = await client.query(`
          INSERT INTO notifications (
            user_id, type, priority, title, message, 
            related_entity_type, related_entity_id, from_user_id,
            action_url, action_data, sent_channels, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
          RETURNING *
        `, [
          userId, type, priority, title, message,
          relatedEntityType, relatedEntityId, fromUserId,
          actionUrl, JSON.stringify(actionData || {}), channels
        ]);

        return result.rows[0];
      });

      // Deliver immediately if requested or if urgent
      if (deliverImmediately || priority === this.priorityLevels.URGENT) {
        await this.deliverNotification(notification);
      }

      // Publish real-time notification
      await this.publishRealTimeNotification(notification);

      logger.debug('Notification created', {
        notificationId: notification.id,
        userId,
        type,
        priority
      });

      return notification;

    } catch (error) {
      logger.logError(error, {
        context: 'NotificationService.createNotification',
        notificationData
      });
      throw error;
    }
  }

  /**
   * Generate smart notification digest
   */
  async generateDigest(userId, options = {}) {
    try {
      const {
        maxAge = 24, // hours
        includeRead = false,
        digestType = this.digestTypes.DAILY
      } = options;

      // Get user's notification preferences
      const userPrefs = await this.getUserNotificationPreferences(userId);

      // Get unread notifications within the time window
      const notifications = await this.getNotificationsForDigest(userId, maxAge, includeRead);

      if (notifications.length === 0) {
        return {
          summary: '📋 No new notifications',
          urgent: [],
          reviewsNeeded: [],
          updates: [],
          metrics: {
            totalNotifications: 0,
            unreadCount: 0,
            urgentCount: 0
          }
        };
      }

      // Categorize notifications
      const categorized = this.categorizeNotifications(notifications);

      // Generate summary
      const summary = this.generateDigestSummary(categorized, userPrefs);

      // Get actionable items
      const actionableItems = this.getActionableItems(categorized);

      const digest = {
        summary,
        urgent: categorized.urgent,
        reviewsNeeded: actionableItems.reviews,
        updates: categorized.updates,
        bottlenecks: actionableItems.bottlenecks,
        deadlines: actionableItems.deadlines,
        metrics: {
          totalNotifications: notifications.length,
          unreadCount: notifications.filter(n => !n.read_at).length,
          urgentCount: categorized.urgent.length,
          reviewsCount: actionableItems.reviews.length,
          deadlinesCount: actionableItems.deadlines.length
        },
        generatedAt: new Date().toISOString(),
        digestType
      };

      logger.info('Notification digest generated', {
        userId,
        totalNotifications: notifications.length,
        urgentCount: categorized.urgent.length,
        digestType
      });

      return digest;

    } catch (error) {
      logger.logError(error, {
        context: 'NotificationService.generateDigest',
        userId,
        options
      });
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    try {
      const result = await query(`
        UPDATE notifications 
        SET read_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND user_id = $2 AND read_at IS NULL
        RETURNING id
      `, [notificationId, userId]);

      if (result.rows.length === 0) {
        return { success: false, message: 'Notification not found or already read' };
      }

      // Publish real-time update
      await publish(`user_${userId}_notifications`, {
        type: 'notification_read',
        notificationId,
        timestamp: new Date().toISOString()
      });

      return { success: true, message: 'Notification marked as read' };

    } catch (error) {
      logger.logError(error, {
        context: 'NotificationService.markAsRead',
        notificationId,
        userId
      });
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId) {
    try {
      const result = await query(`
        UPDATE notifications 
        SET read_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND read_at IS NULL
        RETURNING COUNT(*) as updated_count
      `, [userId]);

      const updatedCount = result.rows[0]?.updated_count || 0;

      // Publish real-time update
      await publish(`user_${userId}_notifications`, {
        type: 'all_notifications_read',
        updatedCount,
        timestamp: new Date().toISOString()
      });

      logger.info('All notifications marked as read', {
        userId,
        updatedCount
      });

      return { 
        success: true, 
        message: `${updatedCount} notifications marked as read`,
        updatedCount
      };

    } catch (error) {
      logger.logError(error, {
        context: 'NotificationService.markAllAsRead',
        userId
      });
      throw error;
    }
  }

  /**
   * Update user notification preferences
   */
  async updateNotificationPreferences(userId, preferences) {
    try {
      const result = await query(`
        UPDATE users 
        SET notification_preferences = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING notification_preferences
      `, [userId, JSON.stringify(preferences)]);

      logger.info('Notification preferences updated', {
        userId,
        preferences
      });

      return result.rows[0]?.notification_preferences || {};

    } catch (error) {
      logger.logError(error, {
        context: 'NotificationService.updateNotificationPreferences',
        userId,
        preferences
      });
      throw error;
    }
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotifications(notifications, options = {}) {
    try {
      const {
        batchSize = 50,
        skipDuplicateCheck = true
      } = options;

      const results = [];
      const errors = [];

      // Process in batches
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (notificationData) => {
          try {
            const notification = await this.createNotification(notificationData, {
              skipDuplicateCheck
            });
            return { success: true, notification };
          } catch (error) {
            return { 
              success: false, 
              error: error.message, 
              notificationData 
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach(result => {
          if (result.success) {
            results.push(result.notification);
          } else {
            errors.push(result);
          }
        });
      }

      logger.info('Bulk notifications sent', {
        total: notifications.length,
        successful: results.length,
        failed: errors.length
      });

      return {
        successful: results.length,
        failed: errors.length,
        results,
        errors
      };

    } catch (error) {
      logger.logError(error, {
        context: 'NotificationService.sendBulkNotifications',
        notificationsCount: notifications.length
      });
      throw error;
    }
  }

  /**
   * Check for duplicate notifications
   */
  async checkForDuplicate(userId, type, relatedEntityType, relatedEntityId) {
    try {
      const result = await query(`
        SELECT id FROM notifications
        WHERE user_id = $1 
          AND type = $2 
          AND related_entity_type = $3 
          AND related_entity_id = $4
          AND created_at > NOW() - INTERVAL '1 hour'
          AND read_at IS NULL
      `, [userId, type, relatedEntityType, relatedEntityId]);

      return result.rows.length > 0;

    } catch (error) {
      logger.logError(error, {
        context: 'NotificationService.checkForDuplicate'
      });
      return false;
    }
  }

  /**
   * Get user notification preferences
   */
  async getUserNotificationPreferences(userId) {
    try {
      const result = await query(
        'SELECT notification_preferences FROM users WHERE id = $1',
        [userId]
      );

      const defaultPrefs = {
        email: true,
        inApp: true,
        digest: 'daily',
        urgentOnly: false,
        categories: {
          course_overdue: true,
          review_requested: true,
          workflow_transition: true,
          assignment_created: true,
          deadline_approaching: true,
          bottleneck_detected: true,
          bulk_operation_complete: false,
          status_change: false,
          dependency_conflict: true
        }
      };

      return result.rows[0]?.notification_preferences || defaultPrefs;

    } catch (error) {
      logger.logError(error, {
        context: 'NotificationService.getUserNotificationPreferences',
        userId
      });
      return {};
    }
  }

  /**
   * Get notifications for digest generation
   */
  async getNotificationsForDigest(userId, maxAge, includeRead) {
    try {
      let whereClause = 'WHERE user_id = $1 AND n.created_at > NOW() - INTERVAL \'$2 hours\'';
      const params = [userId, maxAge];

      if (!includeRead) {
        whereClause += ' AND read_at IS NULL';
      }

      const result = await query(`
        SELECT 
          n.*,
          fu.name as from_user_name,
          fu.email as from_user_email
        FROM notifications n
        LEFT JOIN users fu ON n.from_user_id = fu.id
        ${whereClause}
        ORDER BY n.created_at DESC
      `, params);

      return result.rows;

    } catch (error) {
      logger.logError(error, {
        context: 'NotificationService.getNotificationsForDigest',
        userId,
        maxAge
      });
      return [];
    }
  }

  /**
   * Categorize notifications for digest
   */
  categorizeNotifications(notifications) {
    const categorized = {
      urgent: [],
      updates: [],
      reviews: [],
      deadlines: [],
      bottlenecks: [],
      general: []
    };

    notifications.forEach(notification => {
      if (notification.priority === this.priorityLevels.URGENT) {
        categorized.urgent.push(this.formatNotificationForDigest(notification));
      }

      switch (notification.type) {
        case this.notificationTypes.REVIEW_REQUESTED:
          categorized.reviews.push(this.formatNotificationForDigest(notification));
          break;
        case this.notificationTypes.DEADLINE_APPROACHING:
        case this.notificationTypes.COURSE_OVERDUE:
          categorized.deadlines.push(this.formatNotificationForDigest(notification));
          break;
        case this.notificationTypes.BOTTLENECK_DETECTED:
          categorized.bottlenecks.push(this.formatNotificationForDigest(notification));
          break;
        case this.notificationTypes.WORKFLOW_TRANSITION:
        case this.notificationTypes.STATUS_CHANGE:
          categorized.updates.push(this.formatNotificationForDigest(notification));
          break;
        default:
          categorized.general.push(this.formatNotificationForDigest(notification));
      }
    });

    return categorized;
  }

  /**
   * Format notification for digest display
   */
  formatNotificationForDigest(notification) {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      priority: notification.priority,
      actionUrl: notification.action_url,
      fromUser: notification.from_user_name,
      fromUserEmail: notification.from_user_email,
      relatedEntityType: notification.related_entity_type,
      relatedEntityId: notification.related_entity_id,
      createdAt: notification.created_at,
      isRead: !!notification.read_at
    };
  }

  /**
   * Generate digest summary
   */
  generateDigestSummary(categorized, userPrefs) {
    const totalItems = Object.values(categorized).reduce((sum, items) => sum + items.length, 0);
    
    if (totalItems === 0) {
      return '📋 No new notifications';
    }

    const summaryParts = [];

    if (categorized.urgent.length > 0) {
      summaryParts.push(`🚨 ${categorized.urgent.length} urgent item${categorized.urgent.length > 1 ? 's' : ''}`);
    }

    if (categorized.reviews.length > 0) {
      summaryParts.push(`📝 ${categorized.reviews.length} review${categorized.reviews.length > 1 ? 's' : ''} needed`);
    }

    if (categorized.deadlines.length > 0) {
      summaryParts.push(`⏰ ${categorized.deadlines.length} deadline alert${categorized.deadlines.length > 1 ? 's' : ''}`);
    }

    if (categorized.updates.length > 0) {
      summaryParts.push(`📊 ${categorized.updates.length} update${categorized.updates.length > 1 ? 's' : ''}`);
    }

    if (summaryParts.length === 0) {
      return `📋 ${totalItems} notification${totalItems > 1 ? 's' : ''} waiting`;
    }

    return summaryParts.join(', ');
  }

  /**
   * Get actionable items from categorized notifications
   */
  getActionableItems(categorized) {
    return {
      reviews: categorized.reviews.slice(0, 5), // Top 5 reviews needed
      bottlenecks: categorized.bottlenecks.slice(0, 3), // Top 3 bottlenecks
      deadlines: categorized.deadlines
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .slice(0, 5) // Most recent 5 deadline alerts
    };
  }

  /**
   * Deliver notification through configured channels
   */
  async deliverNotification(notification) {
    try {
      const userPrefs = await this.getUserNotificationPreferences(notification.user_id);
      const channels = notification.sent_channels || ['in_app'];

      const deliveryPromises = [];

      // Email delivery
      if (channels.includes('email') && userPrefs.email) {
        deliveryPromises.push(this.sendEmailNotification(notification));
      }

      // Teams delivery
      if (channels.includes('teams')) {
        deliveryPromises.push(this.sendTeamsNotification(notification));
      }

      // In-app is always delivered via real-time updates
      if (channels.includes('in_app')) {
        deliveryPromises.push(this.publishRealTimeNotification(notification));
      }

      await Promise.allSettled(deliveryPromises);

    } catch (error) {
      logger.logError(error, {
        context: 'NotificationService.deliverNotification',
        notificationId: notification.id
      });
    }
  }

  /**
   * Send email notification (placeholder for email service integration)
   */
  async sendEmailNotification(notification) {
    try {
      // This would integrate with SendGrid or another email service
      logger.debug('Email notification sent', {
        notificationId: notification.id,
        userId: notification.user_id,
        type: notification.type
      });
    } catch (error) {
      logger.logError(error, {
        context: 'NotificationService.sendEmailNotification',
        notificationId: notification.id
      });
    }
  }

  /**
   * Send Teams notification (placeholder for Teams integration)
   */
  async sendTeamsNotification(notification) {
    try {
      // This would integrate with Microsoft Teams webhook
      logger.debug('Teams notification sent', {
        notificationId: notification.id,
        userId: notification.user_id,
        type: notification.type
      });
    } catch (error) {
      logger.logError(error, {
        context: 'NotificationService.sendTeamsNotification',
        notificationId: notification.id
      });
    }
  }

  /**
   * Publish real-time notification
   */
  async publishRealTimeNotification(notification) {
    try {
      await publish(`user_${notification.user_id}_notifications`, {
        type: 'new_notification',
        notification: this.formatNotificationForDigest(notification),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.logError(error, {
        context: 'NotificationService.publishRealTimeNotification',
        notificationId: notification.id
      });
    }
  }

  /**
   * Clean up old notifications
   */
  async cleanupOldNotifications(daysToKeep = 30) {
    try {
      const result = await query(`
        DELETE FROM notifications 
        WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
          AND read_at IS NOT NULL
      `);

      logger.info('Old notifications cleaned up', {
        deletedCount: result.rowCount,
        daysToKeep
      });

      return result.rowCount;

    } catch (error) {
      logger.logError(error, {
        context: 'NotificationService.cleanupOldNotifications',
        daysToKeep
      });
      throw error;
    }
  }
}

module.exports = NotificationService;