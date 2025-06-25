const Joi = require('joi');
const { query, transaction, buildWhereClause, buildPaginationClause, buildOrderClause } = require('../config/database');
const StatusAggregator = require('../services/StatusAggregator');
const SubtaskService = require('../services/SubtaskService');
const NotificationService = require('../services/NotificationService');
const { asyncHandler, ValidationError, NotFoundError, AuthorizationError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Validation schemas
const createCourseSchema = Joi.object({
  title: Joi.string().min(3).max(255).required().trim(),
  description: Joi.string().max(2000).optional().allow(''),
  modality: Joi.string().valid('WBT', 'ILT/VLT', 'Micro Learning', 'SIMS', 'DAP').required(),
  deliverables: Joi.array().items(
    Joi.number().integer().positive()
  ).optional().when('modality', {
    is: 'WBT',
    then: Joi.array().min(1).required(),
    otherwise: Joi.optional()
  }),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
  ownerId: Joi.number().integer().positive().optional(),
  startDate: Joi.date().optional(),
  dueDate: Joi.date().optional().allow('').when('startDate', {
    is: Joi.exist(),
    then: Joi.date().min(Joi.ref('startDate')),
    otherwise: Joi.date()
  }),
  estimatedHours: Joi.number().integer().min(1).max(1000).optional(),
  estimatedDailyHours: Joi.number().precision(2).min(0.5).max(16).optional(),
  workflowTemplateId: Joi.number().integer().positive().required(),
  metadata: Joi.object().max(20).optional(),
  assignments: Joi.array().items(
    Joi.object({
      userId: Joi.number().integer().positive().required(),
      role: Joi.string().valid('owner', 'designer', 'reviewer', 'approver', 'sme').required()
    })
  ).optional()
});

const updateCourseSchema = Joi.object({
  title: Joi.string().min(3).max(255).optional().trim(),
  description: Joi.string().max(2000).optional().allow(''),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
  status: Joi.string().max(50).optional(),
  ownerId: Joi.number().integer().positive().optional(),
  startDate: Joi.date().optional(),
  dueDate: Joi.date().optional(),
  estimatedHours: Joi.number().integer().min(1).max(1000).optional(),
  estimatedDailyHours: Joi.number().precision(2).min(0.5).max(16).optional(),
  metadata: Joi.object().max(20).optional()
});

// Dynamic subtask schema that will be updated with valid phase statuses
const createSubtaskSchema = (validStatuses = ['pending', 'in_progress', 'completed', 'on_hold', 'alpha_review', 'beta_review', 'final']) => {
  return Joi.object({
    title: Joi.string().min(1).max(255).required().trim(),
    status: Joi.string().valid(...validStatuses).default('pending'),
    isBlocking: Joi.boolean().default(false),
    weight: Joi.number().integer().min(1).max(100).default(1),
    orderIndex: Joi.number().integer().min(1).optional(),
    assignedUserId: Joi.number().integer().positive().optional(),
    assignedUserIds: Joi.array().items(Joi.number().integer().positive()).optional()
  });
};

const updateSubtaskSchema = (validStatuses = ['pending', 'in_progress', 'completed', 'on_hold', 'alpha_review', 'beta_review', 'final']) => {
  return Joi.object({
    title: Joi.string().min(1).max(255).optional().trim(),
    status: Joi.string().valid(...validStatuses).optional(),
    isBlocking: Joi.boolean().optional(),
    weight: Joi.number().integer().min(1).max(100).optional(),
    orderIndex: Joi.number().integer().min(1).optional(),
    assignedUserId: Joi.number().integer().positive().optional(),
    assignedUserIds: Joi.array().items(Joi.number().integer().positive()).optional()
  });
};

class CourseController {
  constructor() {
    this.statusAggregator = new StatusAggregator();
    this.subtaskService = new SubtaskService();
    this.notificationService = new NotificationService();
  }

  // Get valid phase statuses from database
  async getValidPhaseStatuses() {
    try {
      const result = await query(`
        SELECT value FROM phase_statuses 
        WHERE is_active = true 
        ORDER BY sort_order ASC
      `);
      const statuses = result.rows.map(row => row.value);
      // Include legacy statuses for backward compatibility
      return [...new Set([...statuses, 'pending', 'in_progress', 'completed', 'on_hold'])];
    } catch (error) {
      // Fallback to hardcoded statuses if phase_statuses table doesn't exist
      return ['pending', 'in_progress', 'completed', 'on_hold', 'alpha_review', 'beta_review', 'final'];
    }
  }

  /**
   * GET /courses - List courses with filters
   */
  getCourses = asyncHandler(async (req, res) => {
    console.log('=== getCourses CALLED ===');
    console.log('Query params:', JSON.stringify(req.query, null, 2));
    console.log('User:', req.user?.email);
    
    try {
    const {
      status,
      type,
      priority,
      assignee,
      dueBefore,
      dueAfter,
      search,
      workflowState,
      page = 1,
      limit = 20,
      sort = 'due_date',
      order = 'ASC',
      sortBy,
      sortOrder
    } = req.query;

    // Handle both sort/order and sortBy/sortOrder parameter formats
    const requestedSort = sortBy || sort || 'due_date';
    const finalOrder = (sortOrder || order || 'ASC').toUpperCase();

    // Map sort fields to valid database columns (with table alias)
    const sortFieldMap = {
      'due_date': 'c.due_date',
      'created_at': 'c.created_at',
      'updated_at': 'c.updated_at',
      'title': 'c.title',
      'priority': 'c.priority',
      'status': 'c.status',
      'start_date': 'c.start_date'
    };

    const finalSort = sortFieldMap[requestedSort] || 'c.due_date';

    // Build filters
    const filters = {};
    if (status) filters['c.status'] = status;
    if (type) filters['c.type'] = type;
    if (priority) filters['c.priority'] = priority;

    // Build WHERE clause
    const { where, values } = buildWhereClause(filters);
    let paramCount = values.length;
    
    // Add complex filters
    let additionalWhere = [];
    
    // Exclude deleted courses unless specifically requested
    if (!status || status !== 'deleted') {
      additionalWhere.push(`c.status != $${++paramCount}`);
      values.push('deleted');
    }
    
    if (assignee) {
      additionalWhere.push(`EXISTS (SELECT 1 FROM course_assignments ca WHERE ca.course_id = c.id AND ca.user_id = $${++paramCount})`);
      values.push(parseInt(assignee));
    }
    
    if (dueBefore) {
      additionalWhere.push(`c.due_date <= $${++paramCount}`);
      values.push(dueBefore);
    }
    
    if (dueAfter) {
      additionalWhere.push(`c.due_date >= $${++paramCount}`);
      values.push(dueAfter);
    }
    
    if (search) {
      additionalWhere.push(`(c.title ILIKE $${++paramCount} OR c.description ILIKE $${++paramCount})`);
      values.push(`%${search}%`, `%${search}%`);
    }

    // Workflow state filtering
    if (workflowState) {
      additionalWhere.push(`wi.current_state = $${++paramCount}`);
      values.push(workflowState);
    }

    // Role-based filtering
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      additionalWhere.push(`EXISTS (SELECT 1 FROM course_assignments ca WHERE ca.course_id = c.id AND ca.user_id = $${++paramCount})`);
      values.push(req.user.id);
    }

    const allConditions = [where, ...additionalWhere].filter(Boolean);
    const whereClause = allConditions.length > 0 ? `WHERE ${allConditions.join(' AND ')}` : '';

    // Pagination and ordering
    const { limit: finalLimit, offset } = buildPaginationClause(parseInt(page), parseInt(limit));
    // Since we already have the properly formatted sort field, create order clause directly
    const allowedOrders = ['ASC', 'DESC'];
    const safeOrder = allowedOrders.includes(finalOrder) ? finalOrder : 'ASC';
    const orderClause = `ORDER BY ${finalSort} ${safeOrder}`;

    // Get total count (with same JOINs for consistent filtering)
    const countResult = await query(`
      SELECT COUNT(DISTINCT c.id) as total
      FROM courses c
      LEFT JOIN workflow_instances wi ON c.id = wi.course_id AND wi.is_complete = false
      LEFT JOIN workflow_templates wt ON wi.workflow_template_id = wt.id
      ${whereClause}
    `, values);

    const total = parseInt(countResult.rows[0].total);
    const pages = Math.ceil(total / finalLimit);

    // Get courses with assignments and workflow info
    const coursesResult = await query(`
      SELECT 
        c.*,
        wi.current_state as workflow_state,
        wi.state_entered_at,
        wt.name as workflow_template_name,
        jsonb_build_object(
          'id', owner.id,
          'name', owner.name,
          'email', owner.email
        ) as owner,
        array_agg(
          DISTINCT jsonb_build_object(
            'userId', ca.user_id,
            'name', u.name,
            'email', u.email,
            'role', ca.role,
            'assignedAt', ca.assigned_at
          )
        ) FILTER (WHERE ca.user_id IS NOT NULL) as assignments
      FROM courses c
      LEFT JOIN workflow_instances wi ON c.id = wi.course_id AND wi.is_complete = false
      LEFT JOIN workflow_templates wt ON wi.workflow_template_id = wt.id
      LEFT JOIN users owner ON c.owner_id = owner.id
      LEFT JOIN course_assignments ca ON c.id = ca.course_id
      LEFT JOIN users u ON ca.user_id = u.id
      ${whereClause}
      GROUP BY c.id, wi.current_state, wi.state_entered_at, wt.name, owner.id, owner.name, owner.email
      ${orderClause}
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `, [...values, finalLimit, offset]);

    res.json({
      success: true,
      data: {
        courses: coursesResult.rows.map(course => ({
          ...course,
          assignments: course.assignments || []
        })),
        pagination: {
          page: parseInt(page),
          limit: finalLimit,
          total,
          pages
        }
      }
    });
    } catch (error) {
      console.log('=== ERROR IN getCourses ===');
      console.log('Error:', error.message);
      console.log('Stack:', error.stack);
      throw error;
    }
  });

  /**
   * POST /courses - Create new course
   */
  createCourse = asyncHandler(async (req, res) => {
    // Validate input
    const { error, value } = createCourseSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid course data', error.details);
    }

    const {
      title,
      description,
      modality,
      deliverables = [],
      priority,
      ownerId,
      startDate,
      dueDate,
      estimatedHours,
      estimatedDailyHours,
      workflowTemplateId,
      metadata,
      assignments = []
    } = value;

    // Check if workflow template exists
    const templateCheck = await query(
      'SELECT id, name FROM workflow_templates WHERE id = $1 AND is_active = true',
      [workflowTemplateId]
    );

    if (templateCheck.rows.length === 0) {
      throw new ValidationError('Invalid workflow template', [{
        field: 'workflowTemplateId',
        message: 'Workflow template not found or inactive'
      }]);
    }

    const result = await transaction(async (client) => {
      // Create course
      const courseResult = await client.query(`
        INSERT INTO courses (
          title, description, modality, type, priority, status, owner_id, start_date, due_date,
          estimated_hours, estimated_daily_hours, metadata, created_by, updated_by,
          created_at, updated_at
        ) VALUES ($1, $2, $3, 'standard', $4, 'pre_development', $5, $6, $7, $8, $9, $10, $11, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `, [
        title, description, modality, priority, ownerId || req.user.id, startDate, dueDate,
        estimatedHours, estimatedDailyHours, JSON.stringify(metadata || {}),
        req.user.id
      ]);

      const newCourse = courseResult.rows[0];

      // Create workflow instance
      const initialStateResult = await client.query(
        'SELECT state_name FROM workflow_states WHERE workflow_template_id = $1 AND is_initial = true',
        [workflowTemplateId]
      );

      const initialState = initialStateResult.rows[0]?.state_name || 'planning';

      await client.query(`
        INSERT INTO workflow_instances (
          course_id, workflow_template_id, current_state, state_entered_at, is_complete, created_at
        ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, false, CURRENT_TIMESTAMP)
      `, [newCourse.id, workflowTemplateId, initialState]);

      // Create workflow transition record
      await client.query(`
        INSERT INTO workflow_transitions (
          workflow_instance_id, from_state, to_state, triggered_by, notes, created_at
        ) VALUES (
          (SELECT id FROM workflow_instances WHERE course_id = $1 AND is_complete = false),
          NULL, $2, $3, 'Course created', CURRENT_TIMESTAMP
        )
      `, [newCourse.id, initialState, req.user.id]);

      // Create course assignments
      for (const assignment of assignments) {
        await client.query(`
          INSERT INTO course_assignments (course_id, user_id, role, assigned_by, assigned_at)
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        `, [newCourse.id, assignment.userId, assignment.role, req.user.id]);
      }

      // Auto-assign deliverables based on modality
      if (modality === 'WBT') {
        // For WBT, use user-selected deliverables
        for (const deliverableId of deliverables) {
          await client.query(`
            INSERT INTO course_deliverables (course_id, deliverable_id)
            VALUES ($1, $2)
          `, [newCourse.id, deliverableId]);
        }
      } else {
        // For other modalities, auto-assign deliverables
        const autoDeliverables = await client.query(`
          SELECT d.id
          FROM deliverables d
          INNER JOIN modality_deliverables md ON d.id = md.deliverable_id
          WHERE md.modality = $1 AND md.is_optional = false
        `, [modality]);

        for (const deliverable of autoDeliverables.rows) {
          await client.query(`
            INSERT INTO course_deliverables (course_id, deliverable_id)
            VALUES ($1, $2)
          `, [newCourse.id, deliverable.id]);
        }
      }

      // Auto-create tasks based on modality
      const modalityTasks = await client.query(`
        SELECT task_type, order_index
        FROM modality_tasks
        WHERE modality = $1
        ORDER BY order_index
      `, [modality]);

      for (const task of modalityTasks.rows) {
        // Create subtask
        const subtaskResult = await client.query(`
          INSERT INTO course_subtasks (
            course_id, title, task_type, status, is_blocking, weight, order_index, created_at, updated_at
          ) VALUES ($1, $2, $3, 'alpha_review', $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING *
        `, [
          newCourse.id,
          task.task_type, // Use task_type as title
          task.task_type,
          task.order_index > 1, // Tasks after the first are blocking
          1, // Default weight
          task.order_index
        ]);

        const newSubtask = subtaskResult.rows[0];

        // Auto-create Alpha Review phase status history entry
        await client.query(`
          INSERT INTO phase_status_history (subtask_id, status, started_at, created_at, updated_at)
          VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [newSubtask.id, 'alpha_review']);
      }

      // Create audit log
      await client.query(`
        INSERT INTO audit_logs (
          user_id, entity_type, entity_id, action, changes, created_at
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      `, [
        req.user.id,
        'course',
        newCourse.id,
        'created',
        JSON.stringify({
          title,
          modality,
          type: 'standard',
          priority,
          workflowTemplateId,
          assignmentCount: assignments.length,
          deliverableCount: modality === 'WBT' ? deliverables.length : modalityTasks.rows.length,
          taskCount: modalityTasks.rows.length
        })
      ]);

      return { course: newCourse, tasksCreated: modalityTasks.rows.length };
    });

    const course = result.course;

    // Initial status calculation
    await this.statusAggregator.updateCourseStatus(course.id, { 
      forceUpdate: true,
      triggeredBy: req.user.id 
    });

    // Create notifications for assigned users
    for (const assignment of assignments) {
      if (assignment.userId !== req.user.id) { // Don't notify the creator
        await this.notificationService.createNotification({
          userId: assignment.userId,
          type: 'course_assignment',
          priority: 'normal',
          title: `New Course Assignment: ${title}`,
          message: `You have been assigned to the course "${title}" as ${assignment.role}. Due: ${new Date(dueDate).toLocaleDateString()}`,
          relatedEntityType: 'course',
          relatedEntityId: course.id,
          fromUserId: req.user.id
        });
      }
    }

    logger.info('Course created successfully', {
      courseId: course.id,
      title,
      modality,
      type: 'standard',
      tasksCreated: result.tasksCreated,
      userId: req.user.id
    });

    res.status(201).json({
      success: true,
      data: {
        course,
        tasksCreated: result.tasksCreated,
        message: `Course created successfully with ${result.tasksCreated} auto-generated tasks`
      }
    });
  });

  /**
   * GET /courses/:id - Get course details
   */
  getCourseById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // First ensure workflow_state column exists
    try {
      await query(`SELECT workflow_state FROM courses LIMIT 1`);
    } catch (error) {
      if (error.message && error.message.includes('column "workflow_state" does not exist')) {
        await query(`
          ALTER TABLE courses 
          ADD COLUMN IF NOT EXISTS workflow_state VARCHAR(50) DEFAULT 'draft'
        `);
      }
    }

    // Get basic course data first (this ensures we get the correct workflow_state)
    const baseCourseResult = await query(`
      SELECT c.*, c.workflow_state as current_workflow_state
      FROM courses c
      WHERE c.id = $1
    `, [id]);

    if (baseCourseResult.rows.length === 0) {
      throw new NotFoundError('Course not found');
    }

    const baseCourse = baseCourseResult.rows[0];

    // Get additional data with joins
    const courseResult = await query(`
      SELECT 
        COALESCE(wi.state_entered_at, c.updated_at) as state_entered_at,
        wi.state_data,
        wt.name as workflow_template_name,
        wt.id as workflow_template_id,
        jsonb_build_object(
          'id', owner.id,
          'name', owner.name,
          'email', owner.email
        ) as owner,
        json_agg(
          DISTINCT jsonb_build_object(
            'userId', ca.user_id,
            'name', u.name,
            'email', u.email,
            'role', ca.role,
            'assignedAt', ca.assigned_at
          )
        ) FILTER (WHERE ca.user_id IS NOT NULL) as assignments,
        json_agg(
          DISTINCT jsonb_build_object(
            'courseId', cd.depends_on_course_id,
            'title', dc.title,
            'type', cd.dependency_type
          )
        ) FILTER (WHERE cd.depends_on_course_id IS NOT NULL) as dependencies,
        json_agg(
          DISTINCT jsonb_build_object(
            'id', d.id,
            'name', d.name,
            'description', d.description
          )
        ) FILTER (WHERE d.id IS NOT NULL) as deliverables
      FROM courses c
      LEFT JOIN workflow_instances wi ON c.id = wi.course_id AND wi.is_complete = false
      LEFT JOIN workflow_templates wt ON wi.workflow_template_id = wt.id
      LEFT JOIN users owner ON c.owner_id = owner.id
      LEFT JOIN course_assignments ca ON c.id = ca.course_id
      LEFT JOIN users u ON ca.user_id = u.id
      LEFT JOIN course_dependencies cd ON c.id = cd.course_id
      LEFT JOIN courses dc ON cd.depends_on_course_id = dc.id
      LEFT JOIN course_deliverables cdeliv ON c.id = cdeliv.course_id
      LEFT JOIN deliverables d ON cdeliv.deliverable_id = d.id
      WHERE c.id = $1
      GROUP BY wi.state_entered_at, wi.state_data, wt.name, wt.id, c.updated_at, owner.id, owner.name, owner.email
    `, [id]);

    // Combine base course data with additional data
    const additionalData = courseResult.rows[0] || {};
    const course = {
      ...baseCourse,
      workflow_state: baseCourse.current_workflow_state, // Use the workflow_state from the base course query
      state_entered_at: additionalData.state_entered_at,
      state_data: additionalData.state_data,
      workflow_template_name: additionalData.workflow_template_name,
      workflow_template_id: additionalData.workflow_template_id,
      owner: additionalData.owner,
      assignments: additionalData.assignments || [],
      dependencies: additionalData.dependencies || [],
      deliverables: additionalData.deliverables || []
    };

    logger.info('getCourseById workflow_state debug', {
      courseId: id,
      workflow_state: course.workflow_state,
      current_workflow_state: baseCourse.current_workflow_state
    });

    // Check authorization
    const isAssigned = course.assignments?.some(a => a.userId === req.user.id);
    if (req.user.role !== 'admin' && req.user.role !== 'manager' && !isAssigned) {
      throw new AuthorizationError('Access denied to this course');
    }

    // Get subtasks
    const subtasks = await this.subtaskService.getSubtasks(id);

    // Get available workflow transitions
    const availableTransitions = await query(`
      SELECT DISTINCT ws_to.state_name, ws_to.display_name
      FROM workflow_states ws_from
      JOIN workflow_states ws_to ON ws_from.workflow_template_id = ws_to.workflow_template_id
      WHERE ws_from.workflow_template_id = $1 
        AND ws_from.state_name = $2
        AND ws_to.state_name != ws_from.state_name
    `, [course.workflow_template_id, course.workflow_state]);

    // Calculate current status if needed
    const statusData = await this.statusAggregator.calculateCourseStatus(id);

    res.json({
      success: true,
      data: {
        ...course,
        assignments: course.assignments || [],
        dependencies: course.dependencies || [],
        subtasks,
        availableTransitions: availableTransitions.rows,
        statusData
      }
    });
  });

  /**
   * PUT /courses/:id - Update course
   */
  updateCourse = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Validate input
    const { error, value } = updateCourseSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid course data', error.details);
    }

    // Check if course exists and user has permission
    const courseCheck = await query(`
      SELECT c.*, 
        EXISTS (SELECT 1 FROM course_assignments ca WHERE ca.course_id = c.id AND ca.user_id = $2) as is_assigned
      FROM courses c 
      WHERE c.id = $1
    `, [id, req.user.id]);

    if (courseCheck.rows.length === 0) {
      throw new NotFoundError('Course not found');
    }

    const currentCourse = courseCheck.rows[0];
    const isAuthorized = req.user.role === 'admin' || 
                        req.user.role === 'manager' || 
                        currentCourse.is_assigned;

    if (!isAuthorized) {
      throw new AuthorizationError('Access denied to this course');
    }

    // Track changes
    const changes = {};
    const allowedFields = ['title', 'description', 'type', 'priority', 'status', 'ownerId', 'startDate', 'dueDate', 'estimatedHours', 'estimatedDailyHours', 'metadata'];
    
    allowedFields.forEach(field => {
      const dbField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (value[field] !== undefined && currentCourse[dbField] !== value[field]) {
        changes[field] = {
          from: currentCourse[dbField],
          to: value[field]
        };
      }
    });

    if (Object.keys(changes).length === 0) {
      return res.json({
        success: true,
        data: {
          course: currentCourse,
          message: 'No changes to update'
        }
      });
    }

    const updatedCourse = await transaction(async (client) => {
      // Build update query
      const updateFields = Object.keys(changes).map(field => {
        const dbField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
        return dbField;
      });
      
      const setClause = updateFields.map((field, index) => `${field} = $${index + 2}`).join(', ');
      const updateValues = Object.keys(changes).map(field => value[field]);

      const result = await client.query(`
        UPDATE courses 
        SET ${setClause}, updated_by = $${updateFields.length + 2}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [id, ...updateValues, req.user.id]);

      // Log the update
      await client.query(`
        INSERT INTO audit_logs (
          user_id, entity_type, entity_id, action, changes, created_at
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      `, [
        req.user.id,
        'course',
        id,
        'updated',
        JSON.stringify(changes)
      ]);

      return result.rows[0];
    });

    // Trigger status recalculation if needed
    const significantChanges = ['type', 'status', 'dueDate'].some(field => changes[field]);
    if (significantChanges) {
      await this.statusAggregator.updateCourseStatus(id, { triggeredBy: req.user.id });
    }

    logger.info('Course updated successfully', {
      courseId: id,
      changes: Object.keys(changes),
      userId: req.user.id
    });

    res.json({
      success: true,
      data: {
        course: updatedCourse,
        message: 'Course updated successfully'
      }
    });
  });

  /**
   * DELETE /courses/:id - Delete course (soft delete)
   */
  deleteCourse = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if course exists and user has permission
    const courseCheck = await query(`
      SELECT c.title, c.created_by,
        EXISTS (SELECT 1 FROM course_assignments ca WHERE ca.course_id = c.id AND ca.user_id = $2 AND ca.role = 'owner') as is_owner
      FROM courses c 
      WHERE c.id = $1
    `, [id, req.user.id]);

    if (courseCheck.rows.length === 0) {
      throw new NotFoundError('Course not found');
    }

    const course = courseCheck.rows[0];
    const canDelete = req.user.role === 'admin' || 
                     req.user.role === 'manager' || 
                     course.is_owner;

    if (!canDelete) {
      throw new AuthorizationError('Only course owners, managers, or admins can delete courses');
    }

    await transaction(async (client) => {
      // Soft delete by updating status
      await client.query(`
        UPDATE courses 
        SET status = 'deleted', updated_by = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [id, req.user.id]);

      // Log the deletion
      await client.query(`
        INSERT INTO audit_logs (
          user_id, entity_type, entity_id, action, changes, created_at
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      `, [
        req.user.id,
        'course',
        id,
        'deleted',
        JSON.stringify({ title: course.title, method: 'soft_delete' })
      ]);
    });

    logger.info('Course deleted successfully', {
      courseId: id,
      title: course.title,
      userId: req.user.id
    });

    res.json({
      success: true,
      data: {
        message: 'Course deleted successfully'
      }
    });
  });

  /**
   * POST /courses/:id/subtasks - Create subtask
   */
  createSubtask = asyncHandler(async (req, res) => {
    const { id: courseId } = req.params;

    // Get valid phase statuses and create dynamic schema
    const validStatuses = await this.getValidPhaseStatuses();
    const subtaskSchema = createSubtaskSchema(validStatuses);

    // Validate input
    const { error, value } = subtaskSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid subtask data', error.details);
    }

    const subtask = await this.subtaskService.createSubtask(courseId, value, req.user.id);

    res.status(201).json({
      success: true,
      data: {
        subtask,
        message: 'Subtask created successfully'
      }
    });
  });

  /**
   * PUT /courses/:id/subtasks/:subtaskId - Update subtask
   */
  updateSubtask = asyncHandler(async (req, res) => {
    const { subtaskId } = req.params;


    // Get valid phase statuses and create dynamic schema
    const validStatuses = await this.getValidPhaseStatuses();
    const subtaskSchema = updateSubtaskSchema(validStatuses);

    // Validate input
    const { error, value } = subtaskSchema.validate(req.body);
    if (error) {
      console.log('Validation failed:', error.details);
      throw new ValidationError('Invalid subtask data', error.details);
    }

    const subtask = await this.subtaskService.updateSubtask(subtaskId, value, req.user.id);

    res.json({
      success: true,
      data: {
        subtask,
        message: 'Subtask updated successfully'
      }
    });
  });

  /**
   * DELETE /courses/:id/subtasks/:subtaskId - Delete subtask
   */
  deleteSubtask = asyncHandler(async (req, res) => {
    const { subtaskId } = req.params;

    const result = await this.subtaskService.deleteSubtask(subtaskId, req.user.id);

    res.json({
      success: true,
      data: result
    });
  });

  /**
   * PUT /courses/:id/subtasks/:subtaskId/phase-history/:historyId - Update phase status history dates
   */
  updatePhaseStatusHistory = asyncHandler(async (req, res) => {
    const { historyId } = req.params;
    const { started_at, finished_at } = req.body;

    // Validate input
    const schema = Joi.object({
      started_at: Joi.date().optional(),
      finished_at: Joi.date().optional().when('started_at', {
        is: Joi.exist(),
        then: Joi.date().min(Joi.ref('started_at')),
        otherwise: Joi.date()
      })
    });

    const { error, value } = schema.validate({ started_at, finished_at });
    if (error) {
      throw new ValidationError('Invalid date data', error.details);
    }

    // Update the phase status history record
    await transaction(async (client) => {
      const updateFields = [];
      const values = [];
      let paramIndex = 1;

      if (value.started_at !== undefined) {
        updateFields.push(`started_at = $${paramIndex++}`);
        values.push(value.started_at);
      }

      if (value.finished_at !== undefined) {
        updateFields.push(`finished_at = $${paramIndex++}`);
        values.push(value.finished_at);
      }

      if (updateFields.length === 0) {
        throw new ValidationError('No valid date fields provided');
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(historyId);

      const result = await client.query(`
        UPDATE phase_status_history 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError(`Phase status history record ${historyId} not found`);
      }

      // Log the update
      await client.query(`
        INSERT INTO audit_logs (
          user_id, entity_type, entity_id, action, changes, created_at
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      `, [
        req.user.id,
        'phase_status_history',
        historyId,
        'updated',
        JSON.stringify({
          started_at: { to: value.started_at },
          finished_at: { to: value.finished_at }
        })
      ]);

      return result.rows[0];
    });

    logger.info('Phase status history updated', {
      historyId,
      userId: req.user.id,
      changes: value
    });

    res.json({
      success: true,
      data: {
        message: 'Phase status history updated successfully'
      }
    });
  });

  /**
   * GET /courses/:id/status - Get course status calculation
   */
  getCourseStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const statusData = await this.statusAggregator.calculateCourseStatus(id);

    res.json({
      success: true,
      data: statusData
    });
  });

  /**
   * POST /courses/:id/recalculate-status - Force status recalculation
   */
  recalculateStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const statusData = await this.statusAggregator.updateCourseStatus(id, {
      forceUpdate: true,
      triggeredBy: req.user.id
    });

    res.json({
      success: true,
      data: {
        statusData,
        message: 'Status recalculated successfully'
      }
    });
  });

  /**
   * GET /courses/deliverables - Get all deliverables
   */
  getDeliverables = asyncHandler(async (req, res) => {
    const deliverables = await query(`
      SELECT * FROM deliverables
      WHERE is_active = true
      ORDER BY name
    `);

    res.json({
      success: true,
      data: deliverables.rows
    });
  });

  /**
   * GET /courses/deliverables/:modality - Get deliverables for a specific modality
   */
  getModalityDeliverables = asyncHandler(async (req, res) => {
    const { modality } = req.params;

    const deliverables = await query(`
      SELECT d.id, d.name, d.description, md.is_optional
      FROM deliverables d
      INNER JOIN modality_deliverables md ON d.id = md.deliverable_id
      WHERE md.modality = $1 AND d.is_active = true
      ORDER BY d.name
    `, [modality]);

    res.json({
      success: true,
      data: deliverables.rows
    });
  });

  /**
   * GET /courses/modality-info/:modality - Get complete modality information
   */
  getModalityInfo = asyncHandler(async (req, res) => {
    const { modality } = req.params;

    // Get deliverables
    const deliverables = await query(`
      SELECT d.id, d.name, d.description, md.is_optional
      FROM deliverables d
      INNER JOIN modality_deliverables md ON d.id = md.deliverable_id
      WHERE md.modality = $1 AND d.is_active = true
      ORDER BY d.name
    `, [modality]);

    // Get tasks
    const tasks = await query(`
      SELECT task_type, order_index
      FROM modality_tasks
      WHERE modality = $1
      ORDER BY order_index
    `, [modality]);

    res.json({
      success: true,
      data: {
        modality,
        deliverables: deliverables.rows,
        tasks: tasks.rows
      }
    });
  });

  /**
   * POST /courses/:id/transition - Workflow state transition
   */
  transitionWorkflow = asyncHandler(async (req, res) => {
    const { id: courseId } = req.params;
    const { newState, notes = '' } = req.body;

    if (!newState) {
      throw new ValidationError('New workflow state is required');
    }

    // First, ensure the workflow_state column exists (outside transaction)
    try {
      await query(`SELECT workflow_state FROM courses LIMIT 1`);
    } catch (error) {
      if (error.message && error.message.includes('column "workflow_state" does not exist')) {
        logger.info('Adding workflow_state column to courses table');
        await query(`
          ALTER TABLE courses 
          ADD COLUMN IF NOT EXISTS workflow_state VARCHAR(50) DEFAULT 'draft'
        `);
      }
    }

    const result = await transaction(async (client) => {
      // Get current course info
      const courseResult = await client.query(`
        SELECT c.*, c.workflow_state
        FROM courses c
        WHERE c.id = $1
      `, [courseId]);

      if (courseResult.rows.length === 0) {
        throw new NotFoundError('Course not found');
      }

      const course = courseResult.rows[0];
      const currentState = course.workflow_state || 'draft';

      logger.info('Workflow transition debug', {
        courseId,
        currentState,
        newState,
        courseRow: course
      });

      // Update course workflow_state field
      const updateResult = await client.query(`
        UPDATE courses 
        SET workflow_state = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id, workflow_state
      `, [newState, courseId]);

      logger.info('Update result', {
        courseId,
        updateResult: updateResult.rows[0]
      });

      // Don't try to update workflow_instances or workflow_transitions within this transaction
      // since they might have schema issues that could abort the transaction

      return {
        courseId,
        fromState: currentState,
        toState: newState,
        triggeredBy: req.user.id,
        notes
      };
    });

    // Try to update workflow instances and create transition records outside the main transaction
    // This way they won't affect the core workflow_state update if they fail
    try {
      await query(`
        UPDATE workflow_instances 
        SET current_state = $1, state_entered_at = CURRENT_TIMESTAMP
        WHERE course_id = $2 AND is_complete = false
      `, [newState, courseId]);
    } catch (error) {
      logger.warn('Workflow instances table update failed', { courseId, error: error.message });
    }

    try {
      await query(`
        INSERT INTO workflow_transitions (
          workflow_instance_id, from_state, to_state, triggered_by, notes, created_at
        ) VALUES (
          (SELECT id FROM workflow_instances WHERE course_id = $1 AND is_complete = false LIMIT 1),
          $2, $3, $4, $5, CURRENT_TIMESTAMP
        )
      `, [courseId, result.fromState, result.toState, req.user.id, notes]);
    } catch (error) {
      logger.warn('Workflow transitions table insert failed', { courseId, error: error.message });
    }

    logger.info('Workflow transition completed', {
      courseId,
      fromState: result.fromState,
      toState: result.toState,
      triggeredBy: req.user.id
    });

    res.json({
      success: true,
      data: {
        ...result,
        message: `Workflow transitioned from ${result.fromState} to ${result.toState}`
      }
    });
  });
}

module.exports = new CourseController();