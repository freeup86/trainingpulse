const Bull = require('bull');
const StatusAggregator = require('./StatusAggregator');
const logger = require('../utils/logger');

/**
 * Job Scheduler Service
 * Handles background jobs for status aggregation and other periodic tasks
 */
class JobScheduler {
  constructor() {
    this.statusAggregator = new StatusAggregator();
    this.queues = {};
    this.initializeQueues();
  }

  initializeQueues() {
    // Status aggregation queue
    this.queues.statusAggregation = new Bull('status aggregation', {
      redis: {
        host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'localhost',
        port: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).port : 6379,
        password: process.env.REDIS_PASSWORD || undefined
      },
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });

    // Process status aggregation jobs
    this.queues.statusAggregation.process('update-course-status', this.processCourseStatusUpdate.bind(this));
    this.queues.statusAggregation.process('bulk-status-update', this.processBulkStatusUpdate.bind(this));
    this.queues.statusAggregation.process('periodic-status-check', this.processPeriodicStatusCheck.bind(this));

    // Event handlers
    this.queues.statusAggregation.on('completed', (job, result) => {
      logger.debug('Status aggregation job completed', {
        jobId: job.id,
        jobType: job.name,
        result
      });
    });

    this.queues.statusAggregation.on('failed', (job, err) => {
      logger.error('Status aggregation job failed', {
        jobId: job.id,
        jobType: job.name,
        error: err.message,
        data: job.data
      });
    });

    this.queues.statusAggregation.on('stalled', (job) => {
      logger.warn('Status aggregation job stalled', {
        jobId: job.id,
        jobType: job.name,
        data: job.data
      });
    });

    logger.info('Job queues initialized successfully');
  }

  /**
   * Schedule single course status update
   */
  async scheduleCourseStatusUpdate(courseId, options = {}) {
    try {
      const {
        delay = 0,
        priority = 0,
        forceUpdate = false,
        triggeredBy = null
      } = options;

      const job = await this.queues.statusAggregation.add('update-course-status', {
        courseId,
        forceUpdate,
        triggeredBy,
        scheduledAt: new Date().toISOString()
      }, {
        delay,
        priority,
        jobId: `course-status-${courseId}-${Date.now()}` // Unique job ID
      });

      logger.debug('Course status update job scheduled', {
        jobId: job.id,
        courseId,
        delay,
        priority
      });

      return job;

    } catch (error) {
      logger.logError(error, {
        context: 'JobScheduler.scheduleCourseStatusUpdate',
        courseId,
        options
      });
      throw error;
    }
  }

  /**
   * Schedule bulk status update for multiple courses
   */
  async scheduleBulkStatusUpdate(courseIds, options = {}) {
    try {
      const {
        delay = 0,
        priority = 0,
        batchSize = 50,
        triggeredBy = null
      } = options;

      // Split into batches to avoid overwhelming the system
      const batches = [];
      for (let i = 0; i < courseIds.length; i += batchSize) {
        batches.push(courseIds.slice(i, i + batchSize));
      }

      const jobs = [];
      for (let i = 0; i < batches.length; i++) {
        const job = await this.queues.statusAggregation.add('bulk-status-update', {
          courseIds: batches[i],
          batchIndex: i,
          totalBatches: batches.length,
          triggeredBy,
          scheduledAt: new Date().toISOString()
        }, {
          delay: delay + (i * 1000), // Stagger batch processing
          priority,
          jobId: `bulk-status-${Date.now()}-batch-${i}`
        });

        jobs.push(job);
      }

      logger.info('Bulk status update jobs scheduled', {
        totalCourses: courseIds.length,
        batches: batches.length,
        batchSize,
        delay
      });

      return jobs;

    } catch (error) {
      logger.logError(error, {
        context: 'JobScheduler.scheduleBulkStatusUpdate',
        courseIds: courseIds.length,
        options
      });
      throw error;
    }
  }

  /**
   * Schedule periodic status check
   */
  async schedulePeriodicStatusCheck() {
    try {
      // Schedule immediate check
      await this.queues.statusAggregation.add('periodic-status-check', {
        scheduledAt: new Date().toISOString()
      }, {
        priority: 1,
        jobId: `periodic-check-${Date.now()}`
      });

      // Schedule recurring check every 15 minutes
      await this.queues.statusAggregation.add('periodic-status-check', {
        type: 'recurring',
        scheduledAt: new Date().toISOString()
      }, {
        repeat: { cron: '*/15 * * * *' }, // Every 15 minutes
        jobId: 'periodic-status-check-recurring'
      });

      logger.info('Periodic status check jobs scheduled');

    } catch (error) {
      logger.logError(error, {
        context: 'JobScheduler.schedulePeriodicStatusCheck'
      });
      throw error;
    }
  }

  /**
   * Process single course status update job
   */
  async processCourseStatusUpdate(job) {
    const { courseId, forceUpdate, triggeredBy } = job.data;

    try {
      const result = await this.statusAggregator.updateCourseStatus(courseId, {
        forceUpdate,
        triggeredBy
      });

      return {
        success: true,
        courseId,
        status: result.calculatedStatus,
        percentage: result.completionPercentage,
        processedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.logError(error, {
        context: 'JobScheduler.processCourseStatusUpdate',
        jobId: job.id,
        courseId
      });
      throw error;
    }
  }

  /**
   * Process bulk status update job
   */
  async processBulkStatusUpdate(job) {
    const { courseIds, batchIndex, totalBatches, triggeredBy } = job.data;

    try {
      const { results, errors } = await this.statusAggregator.bulkUpdateStatus(courseIds, {
        skipEventEmission: true, // Reduce Redis load for bulk operations
        triggeredBy
      });

      logger.info('Bulk status update batch completed', {
        batchIndex: batchIndex + 1,
        totalBatches,
        coursesInBatch: courseIds.length,
        successful: results.length,
        failed: errors.length
      });

      return {
        success: true,
        batchIndex,
        totalBatches,
        coursesProcessed: courseIds.length,
        successful: results.length,
        failed: errors.length,
        processedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.logError(error, {
        context: 'JobScheduler.processBulkStatusUpdate',
        jobId: job.id,
        batchIndex,
        coursesCount: courseIds.length
      });
      throw error;
    }
  }

  /**
   * Process periodic status check job
   */
  async processPeriodicStatusCheck(job) {
    try {
      const result = await this.statusAggregator.runPeriodicUpdate();

      logger.info('Periodic status check completed', {
        jobId: job.id,
        updated: result.updated,
        errors: result.errors
      });

      return {
        success: true,
        coursesUpdated: result.updated,
        errors: result.errors,
        processedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.logError(error, {
        context: 'JobScheduler.processPeriodicStatusCheck',
        jobId: job.id
      });
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    try {
      const stats = {};

      for (const [queueName, queue] of Object.entries(this.queues)) {
        const [waiting, active, completed, failed] = await Promise.all([
          queue.waiting(),
          queue.active(),
          queue.completed(),
          queue.failed()
        ]);

        stats[queueName] = {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          total: waiting.length + active.length + completed.length + failed.length
        };
      }

      return stats;

    } catch (error) {
      logger.logError(error, {
        context: 'JobScheduler.getQueueStats'
      });
      throw error;
    }
  }

  /**
   * Clean old completed jobs
   */
  async cleanOldJobs() {
    try {
      for (const [queueName, queue] of Object.entries(this.queues)) {
        await queue.clean(24 * 60 * 60 * 1000, 'completed'); // Keep completed jobs for 24 hours
        await queue.clean(7 * 24 * 60 * 60 * 1000, 'failed'); // Keep failed jobs for 7 days
      }

      logger.info('Old jobs cleaned successfully');

    } catch (error) {
      logger.logError(error, {
        context: 'JobScheduler.cleanOldJobs'
      });
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    try {
      logger.info('Shutting down job scheduler...');

      const shutdownPromises = Object.entries(this.queues).map(([queueName, queue]) => {
        logger.info(`Closing queue: ${queueName}`);
        return queue.close();
      });

      await Promise.all(shutdownPromises);
      logger.info('Job scheduler shutdown completed');

    } catch (error) {
      logger.logError(error, {
        context: 'JobScheduler.shutdown'
      });
    }
  }

  /**
   * Initialize recurring jobs
   */
  async initializeRecurringJobs() {
    try {
      // Schedule periodic status checks
      await this.schedulePeriodicStatusCheck();

      // Schedule daily cleanup
      await this.queues.statusAggregation.add('cleanup-old-jobs', {}, {
        repeat: { cron: '0 2 * * *' }, // Daily at 2 AM
        jobId: 'daily-cleanup'
      });

      logger.info('Recurring jobs initialized');

    } catch (error) {
      logger.logError(error, {
        context: 'JobScheduler.initializeRecurringJobs'
      });
    }
  }
}

// Export singleton instance
const jobScheduler = new JobScheduler();

// Initialize recurring jobs when module is loaded
if (process.env.NODE_ENV !== 'test') {
  jobScheduler.initializeRecurringJobs().catch(error => {
    logger.logError(error, {
      context: 'JobScheduler initialization'
    });
  });
}

module.exports = jobScheduler;