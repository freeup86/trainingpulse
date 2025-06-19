const Joi = require('joi');
const { query, transaction } = require('../config/database');
const { asyncHandler, ValidationError, AuthorizationError } = require('../middleware/errorHandler');
const { publish } = require('../config/redis');
const logger = require('../utils/logger');

// Validation schemas
const workflowTemplateSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(500).optional(),
  courseType: Joi.string().valid('standard', 'compliance', 'certification').required(),
  stages: Joi.array().items(
    Joi.object({
      name: Joi.string().min(2).max(100).required(),
      description: Joi.string().max(500).optional(),
      order: Joi.number().integer().min(1).required(),
      estimatedDays: Joi.number().integer().min(1).max(365).optional(),
      requiredRole: Joi.string().valid('designer', 'reviewer', 'manager').optional(),
      isParallel: Joi.boolean().default(false),
      autoAdvance: Joi.boolean().default(false),
      conditions: Joi.object({
        requiresApproval: Joi.boolean().default(false),
        minimumReviewers: Joi.number().integer().min(1).max(10).default(1),
        allowSelfApproval: Joi.boolean().default(false)
      }).optional()
    })
  ).min(1).max(20).required()
});

const updateInstanceSchema = Joi.object({
  currentStage: Joi.string().max(100).optional(),
  status: Joi.string().valid('active', 'paused', 'completed', 'cancelled').optional(),
  notes: Joi.string().max(1000).optional(),
  reviewerFeedback: Joi.string().max(2000).optional()
});

const transitionSchema = Joi.object({
  action: Joi.string().valid('advance', 'reject', 'approve', 'pause', 'resume').required(),
  notes: Joi.string().max(1000).optional(),
  assignToUser: Joi.number().integer().positive().optional()
});

class WorkflowController {
  /**
   * GET /workflows/templates - Get workflow templates
   */
  getWorkflowTemplates = asyncHandler(async (req, res) => {
    const { courseType = null, active = true } = req.query;

    let templatesQuery = `
      SELECT 
        wt.*,
        (SELECT COUNT(*) FROM workflow_instances WHERE template_id = wt.id) as usage_count
      FROM workflow_templates wt
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    if (active !== 'all') {
      templatesQuery += ` AND wt.active = $${++paramCount}`;
      params.push(active === 'true' || active === true);
    }

    if (courseType) {
      templatesQuery += ` AND wt.course_type = $${++paramCount}`;
      params.push(courseType);
    }

    templatesQuery += ` ORDER BY wt.course_type, wt.name`;

    const templatesResult = await query(templatesQuery, params);

    // Get stages for each template
    for (const template of templatesResult.rows) {
      const stagesResult = await query(`
        SELECT * FROM workflow_stages 
        WHERE template_id = $1 
        ORDER BY stage_order
      `, [template.id]);

      template.stages = stagesResult.rows.map(stage => ({
        id: stage.id,
        name: stage.name,
        description: stage.description,
        order: stage.stage_order,
        estimatedDays: stage.estimated_days,
        requiredRole: stage.required_role,
        isParallel: stage.is_parallel,
        autoAdvance: stage.auto_advance,
        conditions: stage.conditions || {}
      }));
    }

    res.json({
      success: true,
      data: templatesResult.rows.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        courseType: template.course_type,
        stages: template.stages,
        usageCount: parseInt(template.usage_count),
        active: template.active,
        createdAt: template.created_at,
        updatedAt: template.updated_at
      }))
    });
  });

  /**
   * POST /workflows/templates - Create workflow template
   */
  createWorkflowTemplate = asyncHandler(async (req, res) => {
    // Only admins and managers can create workflow templates
    if (!['admin', 'manager'].includes(req.user.role)) {
      throw new AuthorizationError('Only admins and managers can create workflow templates');
    }

    // Validate input
    const { error, value } = workflowTemplateSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid workflow template data', error.details);
    }

    const { name, description, courseType, stages } = value;

    const template = await transaction(async (client) => {
      // Create template
      const templateResult = await client.query(`
        INSERT INTO workflow_templates (name, description, course_type, created_at, updated_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `, [name, description, courseType]);

      const newTemplate = templateResult.rows[0];

      // Create stages
      for (const stage of stages) {
        await client.query(`
          INSERT INTO workflow_stages (
            template_id, name, description, stage_order, estimated_days,
            required_role, is_parallel, auto_advance, conditions, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
        `, [
          newTemplate.id, stage.name, stage.description, stage.order,
          stage.estimatedDays, stage.requiredRole, stage.isParallel,
          stage.autoAdvance, JSON.stringify(stage.conditions || {})
        ]);
      }

      return newTemplate;
    });

    logger.info('Workflow template created', {
      templateId: template.id,
      name: template.name,
      courseType: template.course_type,
      stageCount: stages.length,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: {
        id: template.id,
        name: template.name,
        description: template.description,
        courseType: template.course_type,
        stageCount: stages.length,
        createdAt: template.created_at
      },
      message: 'Workflow template created successfully'
    });
  });

  /**
   * GET /workflows/instances/:courseId - Get workflow instance for course
   */
  getWorkflowInstance = asyncHandler(async (req, res) => {
    const { courseId } = req.params;

    // Check if user has access to this course
    const courseResult = await query(`
      SELECT c.*, ca.role as user_role
      FROM courses c
      LEFT JOIN course_assignments ca ON c.id = ca.course_id AND ca.user_id = $1
      WHERE c.id = $2
    `, [req.user.id, courseId]);

    if (courseResult.rows.length === 0) {
      throw new ValidationError('Course not found');
    }

    const course = courseResult.rows[0];

    // Non-admins/managers need to be assigned to the course
    if (!['admin', 'manager'].includes(req.user.role) && !course.user_role) {
      throw new AuthorizationError('You are not assigned to this course');
    }

    // Get workflow instance
    const instanceResult = await query(`
      SELECT 
        wi.*,
        wt.name as template_name,
        wt.course_type
      FROM workflow_instances wi
      JOIN workflow_templates wt ON wi.template_id = wt.id
      WHERE wi.course_id = $1
    `, [courseId]);

    if (instanceResult.rows.length === 0) {
      // No workflow instance exists yet
      return res.json({
        success: true,
        data: {
          courseId: parseInt(courseId),
          hasWorkflow: false,
          message: 'No workflow instance found for this course'
        }
      });
    }

    const instance = instanceResult.rows[0];

    // Get workflow history
    const historyResult = await query(`
      SELECT 
        wh.*,
        u.name as user_name,
        u.email as user_email
      FROM workflow_history wh
      LEFT JOIN users u ON wh.user_id = u.id
      WHERE wh.instance_id = $1
      ORDER BY wh.created_at DESC
    `, [instance.id]);

    // Get current stage details
    const currentStageResult = await query(`
      SELECT ws.* FROM workflow_stages ws
      JOIN workflow_templates wt ON ws.template_id = wt.id
      JOIN workflow_instances wi ON wi.template_id = wt.id
      WHERE wi.id = $1 AND ws.name = $2
    `, [instance.id, instance.current_stage]);

    const currentStage = currentStageResult.rows[0] || null;

    // Get all stages for this workflow
    const stagesResult = await query(`
      SELECT ws.* FROM workflow_stages ws
      JOIN workflow_instances wi ON wi.template_id = ws.template_id
      WHERE wi.id = $1
      ORDER BY ws.stage_order
    `, [instance.id]);

    res.json({
      success: true,
      data: {
        id: instance.id,
        courseId: instance.course_id,
        templateId: instance.template_id,
        templateName: instance.template_name,
        courseType: instance.course_type,
        currentStage: instance.current_stage,
        status: instance.status,
        startedAt: instance.started_at,
        completedAt: instance.completed_at,
        currentStageDetails: currentStage ? {
          id: currentStage.id,
          name: currentStage.name,
          description: currentStage.description,
          order: currentStage.stage_order,
          estimatedDays: currentStage.estimated_days,
          requiredRole: currentStage.required_role,
          isParallel: currentStage.is_parallel,
          autoAdvance: currentStage.auto_advance,
          conditions: currentStage.conditions || {}
        } : null,
        allStages: stagesResult.rows.map(stage => ({
          id: stage.id,
          name: stage.name,
          description: stage.description,
          order: stage.stage_order,
          estimatedDays: stage.estimated_days,
          requiredRole: stage.required_role,
          isParallel: stage.is_parallel,
          autoAdvance: stage.auto_advance,
          isComplete: false // Will be determined by checking history
        })),
        history: historyResult.rows.map(entry => ({
          id: entry.id,
          fromStage: entry.from_stage,
          toStage: entry.to_stage,
          action: entry.action,
          notes: entry.notes,
          userId: entry.user_id,
          userName: entry.user_name,
          userEmail: entry.user_email,
          createdAt: entry.created_at
        })),
        hasWorkflow: true
      }
    });
  });

  /**
   * POST /workflows/instances/:courseId - Create workflow instance for course
   */
  createWorkflowInstance = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    const { templateId } = req.body;

    // Only admins and managers can create workflow instances
    if (!['admin', 'manager'].includes(req.user.role)) {
      throw new AuthorizationError('Only admins and managers can create workflow instances');
    }

    // Validate template exists
    const templateResult = await query(
      'SELECT * FROM workflow_templates WHERE id = $1 AND active = true',
      [templateId]
    );

    if (templateResult.rows.length === 0) {
      throw new ValidationError('Workflow template not found');
    }

    const template = templateResult.rows[0];

    // Check if course exists and get details
    const courseResult = await query(
      'SELECT * FROM courses WHERE id = $1',
      [courseId]
    );

    if (courseResult.rows.length === 0) {
      throw new ValidationError('Course not found');
    }

    const course = courseResult.rows[0];

    // Verify course type matches template
    if (course.type !== template.course_type) {
      throw new ValidationError(`Course type "${course.type}" does not match template type "${template.course_type}"`);
    }

    const instance = await transaction(async (client) => {
      // Check if workflow instance already exists
      const existingResult = await client.query(
        'SELECT id FROM workflow_instances WHERE course_id = $1',
        [courseId]
      );

      if (existingResult.rows.length > 0) {
        throw new ValidationError('Workflow instance already exists for this course');
      }

      // Get first stage
      const firstStageResult = await client.query(
        'SELECT name FROM workflow_stages WHERE template_id = $1 ORDER BY stage_order LIMIT 1',
        [templateId]
      );

      if (firstStageResult.rows.length === 0) {
        throw new ValidationError('Template has no stages defined');
      }

      const firstStage = firstStageResult.rows[0].name;

      // Create workflow instance
      const instanceResult = await client.query(`
        INSERT INTO workflow_instances (
          course_id, template_id, current_stage, status, started_at, created_at
        ) VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `, [courseId, templateId, firstStage]);

      const newInstance = instanceResult.rows[0];

      // Create initial history entry
      await client.query(`
        INSERT INTO workflow_history (
          instance_id, from_stage, to_stage, action, user_id, notes, created_at
        ) VALUES ($1, NULL, $2, 'started', $3, 'Workflow instance created', CURRENT_TIMESTAMP)
      `, [newInstance.id, firstStage, req.user.id]);

      return newInstance;
    });

    logger.info('Workflow instance created', {
      instanceId: instance.id,
      courseId: instance.course_id,
      templateId: instance.template_id,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: {
        id: instance.id,
        courseId: instance.course_id,
        templateId: instance.template_id,
        currentStage: instance.current_stage,
        status: instance.status,
        startedAt: instance.started_at
      },
      message: 'Workflow instance created successfully'
    });
  });

  /**
   * POST /workflows/instances/:instanceId/transition - Advance workflow stage
   */
  transitionWorkflow = asyncHandler(async (req, res) => {
    const { instanceId } = req.params;

    // Validate input
    const { error, value } = transitionSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid transition data', error.details);
    }

    const { action, notes, assignToUser } = value;

    const result = await transaction(async (client) => {
      // Get workflow instance with current stage details
      const instanceResult = await client.query(`
        SELECT 
          wi.*,
          ws.name as stage_name,
          ws.stage_order,
          ws.required_role,
          ws.auto_advance,
          ws.conditions,
          c.title as course_title
        FROM workflow_instances wi
        JOIN workflow_stages ws ON wi.template_id = ws.template_id AND wi.current_stage = ws.name
        JOIN courses c ON wi.course_id = c.id
        WHERE wi.id = $1
      `, [instanceId]);

      if (instanceResult.rows.length === 0) {
        throw new ValidationError('Workflow instance not found');
      }

      const instance = instanceResult.rows[0];

      // Check if user has permission to perform this action
      const hasPermission = await this.checkWorkflowPermission(
        req.user,
        instance,
        action,
        client
      );

      if (!hasPermission) {
        throw new AuthorizationError('You do not have permission to perform this action');
      }

      let newStage = instance.current_stage;
      let newStatus = instance.status;

      switch (action) {
        case 'advance':
          // Get next stage
          const nextStageResult = await client.query(`
            SELECT name FROM workflow_stages 
            WHERE template_id = $1 AND stage_order > $2
            ORDER BY stage_order LIMIT 1
          `, [instance.template_id, instance.stage_order]);

          if (nextStageResult.rows.length === 0) {
            // No more stages - complete workflow
            newStatus = 'completed';
            
            // Update course status if needed
            await client.query(
              'UPDATE courses SET status = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2',
              ['completed', instance.course_id]
            );
          } else {
            newStage = nextStageResult.rows[0].name;
          }
          break;

        case 'reject':
          // Send back to previous stage or stay in current
          newStatus = 'active';
          break;

        case 'approve':
          // Mark stage as approved but don't advance yet
          newStatus = 'active';
          break;

        case 'pause':
          newStatus = 'paused';
          break;

        case 'resume':
          newStatus = 'active';
          break;
      }

      // Update workflow instance
      const updateResult = await client.query(`
        UPDATE workflow_instances 
        SET current_stage = $1, status = $2, 
            completed_at = CASE WHEN $2 = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `, [newStage, newStatus, instanceId]);

      const updatedInstance = updateResult.rows[0];

      // Create history entry
      await client.query(`
        INSERT INTO workflow_history (
          instance_id, from_stage, to_stage, action, user_id, notes, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      `, [
        instanceId,
        instance.current_stage,
        newStage,
        action,
        req.user.id,
        notes || null
      ]);

      // Handle assignments if specified
      if (assignToUser && action === 'advance') {
        // Logic to assign next stage to specific user would go here
      }

      return {
        instance: updatedInstance,
        previousStage: instance.current_stage,
        courseTitle: instance.course_title
      };
    });

    // Publish real-time update
    await publish(`course_${result.instance.course_id}_workflow`, {
      type: 'workflow_transition',
      instanceId: result.instance.id,
      fromStage: result.previousStage,
      toStage: result.instance.current_stage,
      action,
      userId: req.user.id,
      timestamp: new Date().toISOString()
    });

    logger.info('Workflow transition completed', {
      instanceId: result.instance.id,
      courseId: result.instance.course_id,
      action,
      fromStage: result.previousStage,
      toStage: result.instance.current_stage,
      userId: req.user.id
    });

    res.json({
      success: true,
      data: {
        id: result.instance.id,
        currentStage: result.instance.current_stage,
        status: result.instance.status,
        completedAt: result.instance.completed_at,
        action,
        previousStage: result.previousStage
      },
      message: `Workflow ${action} completed successfully`
    });
  });

  /**
   * PUT /workflows/instances/:instanceId - Update workflow instance
   */
  updateWorkflowInstance = asyncHandler(async (req, res) => {
    const { instanceId } = req.params;

    // Only admins and managers can update workflow instances
    if (!['admin', 'manager'].includes(req.user.role)) {
      throw new AuthorizationError('Only admins and managers can update workflow instances');
    }

    // Validate input
    const { error, value } = updateInstanceSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid update data', error.details);
    }

    const updates = [];
    const params = [];
    let paramCount = 0;

    Object.entries(value).forEach(([key, val]) => {
      const columnName = key === 'currentStage' ? 'current_stage' : key;
      updates.push(`${columnName} = $${++paramCount}`);
      params.push(val);
    });

    if (updates.length === 0) {
      throw new ValidationError('No valid updates provided');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(instanceId);

    const updateQuery = `
      UPDATE workflow_instances 
      SET ${updates.join(', ')}
      WHERE id = $${++paramCount}
      RETURNING *
    `;

    const result = await query(updateQuery, params);

    if (result.rows.length === 0) {
      throw new ValidationError('Workflow instance not found');
    }

    logger.info('Workflow instance updated', {
      instanceId,
      updates: Object.keys(value),
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      data: {
        id: result.rows[0].id,
        currentStage: result.rows[0].current_stage,
        status: result.rows[0].status,
        updatedAt: result.rows[0].updated_at
      },
      message: 'Workflow instance updated successfully'
    });
  });

  /**
   * Check if user has permission to perform workflow action
   */
  async checkWorkflowPermission(user, instance, action, client) {
    // Admins can always perform any action
    if (user.role === 'admin') {
      return true;
    }

    // Check if user is assigned to the course
    const assignmentResult = await client.query(
      'SELECT role FROM course_assignments WHERE course_id = $1 AND user_id = $2',
      [instance.course_id, user.id]
    );

    if (assignmentResult.rows.length === 0 && user.role !== 'manager') {
      return false;
    }

    const userCourseRole = assignmentResult.rows[0]?.role;

    // Check stage-specific permissions
    const stageRequiredRole = instance.required_role;
    
    if (stageRequiredRole && userCourseRole !== stageRequiredRole && user.role !== 'manager') {
      return false;
    }

    // Action-specific checks
    switch (action) {
      case 'advance':
      case 'approve':
        return ['manager', 'reviewer'].includes(user.role) || userCourseRole === 'reviewer';
      case 'reject':
        return ['manager', 'reviewer'].includes(user.role);
      case 'pause':
      case 'resume':
        return ['admin', 'manager'].includes(user.role);
      default:
        return false;
    }
  }

  /**
   * GET /workflows/templates/:id - Get specific workflow template by ID
   */
  getWorkflowTemplateById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const client = await getClient();

    try {
      const result = await client.query(`
        SELECT 
          wt.id,
          wt.name,
          wt.description,
          wt.is_active,
          wt.created_at,
          wt.updated_at,
          COUNT(ws.id) as stage_count,
          (
            SELECT COUNT(*) FROM workflow_instances wi 
            WHERE wi.workflow_template_id = wt.id
          ) as usage_count,
          (
            SELECT COUNT(*) * 100.0 / NULLIF(COUNT(*), 0)
            FROM workflow_instances wi 
            WHERE wi.workflow_template_id = wt.id 
              AND wi.status = 'completed'
          ) as completion_rate
        FROM workflow_templates wt
        LEFT JOIN workflow_states ws ON ws.workflow_template_id = wt.id
        WHERE wt.id = $1
        GROUP BY wt.id
      `, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Workflow template not found');
      }

      const template = result.rows[0];

      // Get workflow stages
      const stagesResult = await client.query(
        `SELECT 
          id,
          state_name,
          display_name,
          is_initial,
          is_final,
          state_config
        FROM workflow_states 
        WHERE workflow_template_id = $1 
        ORDER BY id`,
        [id]
      );

      template.stages = stagesResult.rows.map((stage, index) => ({
        ...stage,
        order: index + 1,
        name: stage.display_name,
        description: stage.state_config?.description || ''
      }));

      res.json({
        success: true,
        data: template
      });
    } finally {
      client.release();
    }
  });

  /**
   * GET /workflows/instances - Get all workflow instances
   */
  getWorkflowInstances = asyncHandler(async (req, res) => {
    const client = await getClient();
    const { limit = 50, offset = 0 } = req.query;

    try {
      const result = await client.query(`
        SELECT 
          wi.id,
          wi.course_id,
          c.title as course_name,
          wt.name as template_name,
          ws.state_name as current_state,
          wi.created_at as started_at,
          wi.updated_at,
          (
            SELECT COUNT(*) FROM workflow_states 
            WHERE workflow_template_id = wi.workflow_template_id
          ) as total_stages,
          (
            SELECT COUNT(*) FROM workflow_states 
            WHERE workflow_template_id = wi.workflow_template_id
              AND id <= wi.current_state_id
          ) as current_stage,
          u.name as assigned_to
        FROM workflow_instances wi
        JOIN courses c ON wi.course_id = c.id
        JOIN workflow_templates wt ON wi.workflow_template_id = wt.id
        JOIN workflow_states ws ON wi.current_state_id = ws.id
        LEFT JOIN course_assignments ca ON ca.course_id = c.id AND ca.role = 'owner'
        LEFT JOIN users u ON ca.user_id = u.id
        WHERE wi.status != 'completed'
        ORDER BY wi.updated_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]);

      res.json({
        success: true,
        data: {
          instances: result.rows
        }
      });
    } finally {
      client.release();
    }
  });
}

module.exports = new WorkflowController();