const Joi = require('joi');
const BulkUpdateService = require('../services/BulkUpdateService');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Validation schemas
const bulkPreviewSchema = Joi.object({
  filter: Joi.object({
    status: Joi.string().max(50).optional(),
    type: Joi.string().valid('standard', 'compliance', 'certification').optional(),
    priority: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
    dueBefore: Joi.date().optional(),
    dueAfter: Joi.date().optional(),
    teamId: Joi.number().integer().positive().optional(),
    assignedToUser: Joi.number().integer().positive().optional(),
    courseIds: Joi.array().items(Joi.number().integer().positive()).max(100).optional(),
    search: Joi.string().max(255).optional()
  }).required(),
  updates: Joi.object({
    title: Joi.string().min(3).max(255).trim().optional(),
    description: Joi.string().max(2000).allow('').optional(),
    type: Joi.string().valid('standard', 'compliance', 'certification').optional(),
    priority: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
    status: Joi.string().max(50).optional(),
    dueDate: Joi.date().optional(),
    startDate: Joi.date().optional(),
    estimatedHours: Joi.number().integer().min(1).max(1000).optional(),
    estimatedDailyHours: Joi.number().precision(2).min(0.5).max(16).optional()
  }).min(1).required(),
  options: Joi.object({
    forceCascade: Joi.boolean().default(false),
    skipValidation: Joi.boolean().default(false),
    batchSize: Joi.number().integer().min(1).max(50).default(20),
    notifyStakeholders: Joi.boolean().default(true)
  }).default({})
});

const bulkExecuteSchema = Joi.object({
  previewId: Joi.string().uuid().required(),
  confirmImpact: Joi.boolean().default(false)
});

class BulkController {
  constructor() {
    this.bulkUpdateService = new BulkUpdateService();
  }

  /**
   * POST /bulk/preview - Preview bulk update
   */
  previewBulkUpdate = asyncHandler(async (req, res) => {
    // Validate input
    const { error, value } = bulkPreviewSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid bulk update data', error.details);
    }

    const { filter, updates, options } = value;

    // Validate date constraints
    if (updates.startDate && updates.dueDate && new Date(updates.startDate) >= new Date(updates.dueDate)) {
      throw new ValidationError('Due date must be after start date');
    }

    const preview = await this.bulkUpdateService.previewBulkUpdate({
      filter,
      updates,
      options
    }, req.user.id);

    logger.info('Bulk update preview generated', {
      userId: req.user.id,
      previewId: preview.previewId,
      totalCourses: preview.totalCourses,
      validCourses: preview.validCourses,
      updateFields: Object.keys(updates)
    });

    res.json({
      success: true,
      data: preview
    });
  });

  /**
   * POST /bulk/execute - Execute bulk update
   */
  executeBulkUpdate = asyncHandler(async (req, res) => {
    // Validate input
    const { error, value } = bulkExecuteSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid execution data', error.details);
    }

    const { previewId, confirmImpact } = value;

    const result = await this.bulkUpdateService.executeBulkUpdate(previewId, req.user.id);

    // Check if there were significant impacts that weren't confirmed
    if (result.errors.length > 0 && !confirmImpact) {
      logger.warn('Bulk update completed with errors', {
        userId: req.user.id,
        previewId,
        successful: result.successful,
        failed: result.failed
      });
    } else {
      logger.info('Bulk update executed successfully', {
        userId: req.user.id,
        previewId,
        successful: result.successful,
        failed: result.failed,
        executionTime: result.executionTime
      });
    }

    res.json({
      success: true,
      data: result
    });
  });

  /**
   * GET /bulk/history - Get bulk update history
   */
  getBulkHistory = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const history = await this.bulkUpdateService.getBulkUpdateHistory(req.user.id, {
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      data: {
        ...history,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: history.pagination.hasMore
        }
      }
    });
  });

  /**
   * DELETE /bulk/cancel/:previewId - Cancel bulk operation
   */
  cancelBulkOperation = asyncHandler(async (req, res) => {
    const { previewId } = req.params;

    // Validate preview ID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(previewId)) {
      throw new ValidationError('Invalid preview ID format');
    }

    const result = await this.bulkUpdateService.cancelBulkOperation(previewId, req.user.id);

    logger.info('Bulk operation cancelled', {
      userId: req.user.id,
      previewId
    });

    res.json({
      success: true,
      data: result
    });
  });

  /**
   * POST /bulk/validate - Validate bulk update criteria
   */
  validateBulkCriteria = asyncHandler(async (req, res) => {
    const { filter = {} } = req.body;

    try {
      // Get matching courses count without full preview
      const matchingCourses = await this.bulkUpdateService.getMatchingCourses(filter, req.user.id);

      const validation = {
        isValid: true,
        courseCount: matchingCourses.length,
        warnings: [],
        errors: []
      };

      // Validate course count
      if (matchingCourses.length === 0) {
        validation.warnings.push('No courses match the specified criteria');
      } else if (matchingCourses.length > 100) {
        validation.isValid = false;
        validation.errors.push('Too many courses selected. Maximum 100 courses allowed per operation.');
      } else if (matchingCourses.length > 50) {
        validation.warnings.push('Large operation - consider splitting into smaller batches');
      }

      // Check for critical courses
      const criticalCourses = matchingCourses.filter(c => c.priority === 'critical');
      if (criticalCourses.length > 0) {
        validation.warnings.push(`${criticalCourses.length} critical priority courses will be affected`);
      }

      // Check for courses due soon
      const soonDueCourses = matchingCourses.filter(c => {
        const dueDate = new Date(c.due_date);
        const daysUntilDue = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
        return daysUntilDue <= 7 && daysUntilDue > 0;
      });

      if (soonDueCourses.length > 0) {
        validation.warnings.push(`${soonDueCourses.length} courses are due within 7 days`);
      }

      res.json({
        success: true,
        data: validation
      });

    } catch (error) {
      logger.logError(error, {
        context: 'BulkController.validateBulkCriteria',
        userId: req.user.id,
        filter
      });
      throw error;
    }
  });

  /**
   * GET /bulk/templates - Get bulk update templates
   */
  getBulkTemplates = asyncHandler(async (req, res) => {
    const templates = [
      {
        id: 'extend_deadlines',
        name: 'Extend Deadlines',
        description: 'Extend due dates for courses by a specified number of days',
        filter: {
          status: 'in_progress'
        },
        updates: {
          dueDate: '{{CURRENT_DUE_DATE + DAYS}}'
        },
        parameters: [
          {
            name: 'days',
            type: 'number',
            label: 'Days to extend',
            min: 1,
            max: 90,
            default: 7
          }
        ]
      },
      {
        id: 'priority_upgrade',
        name: 'Priority Upgrade',
        description: 'Upgrade priority for courses due soon',
        filter: {
          dueBefore: '{{NOW + 14_DAYS}}',
          priority: 'medium'
        },
        updates: {
          priority: 'high'
        },
        parameters: []
      },
      {
        id: 'hold_courses',
        name: 'Put Courses on Hold',
        description: 'Put selected courses on hold temporarily',
        filter: {
          status: 'in_progress'
        },
        updates: {
          status: 'on_hold'
        },
        parameters: []
      },
      {
        id: 'type_conversion',
        name: 'Convert Course Type',
        description: 'Convert courses from one type to another',
        filter: {
          type: 'standard'
        },
        updates: {
          type: 'compliance'
        },
        parameters: [
          {
            name: 'fromType',
            type: 'select',
            label: 'From Type',
            options: ['standard', 'compliance', 'certification'],
            default: 'standard'
          },
          {
            name: 'toType',
            type: 'select',
            label: 'To Type',
            options: ['standard', 'compliance', 'certification'],
            default: 'compliance'
          }
        ]
      }
    ];

    res.json({
      success: true,
      data: {
        templates
      }
    });
  });

  /**
   * POST /bulk/template/:templateId - Apply bulk template
   */
  applyBulkTemplate = asyncHandler(async (req, res) => {
    const { templateId } = req.params;
    const { parameters = {}, additionalFilter = {} } = req.body;

    // Get template (this would typically come from a database)
    const templates = await this.getBulkTemplatesData();
    const template = templates.find(t => t.id === templateId);

    if (!template) {
      throw new ValidationError('Template not found');
    }

    // Process template with parameters
    const processedTemplate = this.processTemplate(template, parameters);

    // Merge with additional filters
    const finalFilter = { ...processedTemplate.filter, ...additionalFilter };

    // Generate preview
    const preview = await this.bulkUpdateService.previewBulkUpdate({
      filter: finalFilter,
      updates: processedTemplate.updates,
      options: { notifyStakeholders: true }
    }, req.user.id);

    logger.info('Bulk template applied', {
      userId: req.user.id,
      templateId,
      parameters,
      previewId: preview.previewId
    });

    res.json({
      success: true,
      data: {
        template: {
          id: templateId,
          name: template.name,
          description: template.description
        },
        preview
      }
    });
  });

  /**
   * Helper method to get templates data
   */
  async getBulkTemplatesData() {
    // This could be moved to a database or configuration file
    return [
      {
        id: 'extend_deadlines',
        name: 'Extend Deadlines',
        description: 'Extend due dates for courses by a specified number of days',
        filter: { status: 'in_progress' },
        updates: { dueDate: '{{CURRENT_DUE_DATE + DAYS}}' }
      },
      {
        id: 'priority_upgrade',
        name: 'Priority Upgrade',
        description: 'Upgrade priority for courses due soon',
        filter: { dueBefore: '{{NOW + 14_DAYS}}', priority: 'medium' },
        updates: { priority: 'high' }
      },
      {
        id: 'hold_courses',
        name: 'Put Courses on Hold',
        description: 'Put selected courses on hold temporarily',
        filter: { status: 'in_progress' },
        updates: { status: 'on_hold' }
      }
    ];
  }

  /**
   * Process template with parameters
   */
  processTemplate(template, parameters) {
    const processed = JSON.parse(JSON.stringify(template));

    // Process filter
    Object.entries(processed.filter).forEach(([key, value]) => {
      if (typeof value === 'string' && value.includes('{{')) {
        processed.filter[key] = this.processTemplateValue(value, parameters);
      }
    });

    // Process updates
    Object.entries(processed.updates).forEach(([key, value]) => {
      if (typeof value === 'string' && value.includes('{{')) {
        processed.updates[key] = this.processTemplateValue(value, parameters);
      }
    });

    return processed;
  }

  /**
   * Process individual template values
   */
  processTemplateValue(value, parameters) {
    let processed = value;

    // Replace parameter placeholders
    Object.entries(parameters).forEach(([param, paramValue]) => {
      processed = processed.replace(new RegExp(`{{${param.toUpperCase()}}}`, 'g'), paramValue);
    });

    // Handle date calculations
    if (processed.includes('NOW + ') && processed.includes('_DAYS')) {
      const daysMatch = processed.match(/NOW \+ (\d+)_DAYS/);
      if (daysMatch) {
        const days = parseInt(daysMatch[1]);
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);
        processed = futureDate.toISOString().split('T')[0];
      }
    }

    return processed;
  }
}

module.exports = new BulkController();