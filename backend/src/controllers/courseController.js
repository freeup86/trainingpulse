const Joi = require('joi');
const { query, transaction, buildWhereClause, buildPaginationClause, buildOrderClause } = require('../config/database');
const StatusAggregator = require('../services/StatusAggregator');
const SubtaskService = require('../services/SubtaskService');
const { asyncHandler, ValidationError, NotFoundError, AuthorizationError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Validation schemas
const createCourseSchema = Joi.object({
  title: Joi.string().min(3).max(255).required().trim(),
  description: Joi.string().max(2000).optional().allow(''),
  type: Joi.string().valid('standard', 'compliance', 'certification').default('standard'),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
  startDate: Joi.date().optional(),
  dueDate: Joi.date().required().when('startDate', {
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
  ).optional(),
  tasks: Joi.array().items(
    Joi.object({
      title: Joi.string().min(1).max(255).required().trim(),
      status: Joi.string().valid('pending', 'in_progress', 'completed', 'on_hold').default('pending'),
      isBlocking: Joi.boolean().default(false),
      weight: Joi.number().integer().min(1).max(100).default(1),
      orderIndex: Joi.number().integer().min(0).optional()
    })
  ).optional()
});

const updateCourseSchema = Joi.object({
  title: Joi.string().min(3).max(255).optional().trim(),
  description: Joi.string().max(2000).optional().allow(''),
  type: Joi.string().valid('standard', 'compliance', 'certification').optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
  status: Joi.string().max(50).optional(),
  startDate: Joi.date().optional(),
  dueDate: Joi.date().optional(),
  estimatedHours: Joi.number().integer().min(1).max(1000).optional(),
  estimatedDailyHours: Joi.number().precision(2).min(0.5).max(16).optional(),
  metadata: Joi.object().max(20).optional()
});

const subtaskSchema = Joi.object({
  title: Joi.string().min(1).max(255).required().trim(),
  status: Joi.string().valid('pending', 'in_progress', 'completed', 'on_hold').default('pending'),
  isBlocking: Joi.boolean().default(false),
  weight: Joi.number().integer().min(1).max(100).default(1),
  orderIndex: Joi.number().integer().min(1).optional()
});

class CourseController {
  constructor() {
    this.statusAggregator = new StatusAggregator();
    this.subtaskService = new SubtaskService();
  }

  /**
   * GET /courses - List courses with filters
   */
  getCourses = asyncHandler(async (req, res) => {
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
      order = 'ASC'
    } = req.query;

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
    const orderClause = buildOrderClause(sort, order);

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
      LEFT JOIN course_assignments ca ON c.id = ca.course_id
      LEFT JOIN users u ON ca.user_id = u.id
      ${whereClause}
      GROUP BY c.id, wi.current_state, wi.state_entered_at, wt.name
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
      type,
      priority,
      startDate,
      dueDate,
      estimatedHours,
      estimatedDailyHours,
      workflowTemplateId,
      metadata,
      assignments = [],
      tasks = []
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

    const course = await transaction(async (client) => {
      // Create course
      const courseResult = await client.query(`
        INSERT INTO courses (
          title, description, type, priority, status, start_date, due_date,
          estimated_hours, estimated_daily_hours, metadata, created_by, updated_by,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, $9, $10, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `, [
        title, description, type, priority, startDate, dueDate,
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

      // Create initial tasks/subtasks
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        await client.query(`
          INSERT INTO course_subtasks (
            course_id, title, status, is_blocking, weight, order_index, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          newCourse.id, 
          task.title, 
          task.status || 'pending', 
          task.isBlocking || false, 
          task.weight || 1, 
          task.orderIndex !== undefined ? task.orderIndex : i + 1
        ]);
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
          type,
          priority,
          workflowTemplateId,
          assignmentCount: assignments.length,
          taskCount: tasks.length
        })
      ]);

      return newCourse;
    });

    // Initial status calculation
    await this.statusAggregator.updateCourseStatus(course.id, { 
      forceUpdate: true,
      triggeredBy: req.user.id 
    });

    logger.info('Course created successfully', {
      courseId: course.id,
      title,
      type,
      userId: req.user.id
    });

    res.status(201).json({
      success: true,
      data: {
        course,
        message: 'Course created successfully'
      }
    });
  });

  /**
   * GET /courses/:id - Get course details
   */
  getCourseById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Get course with full details
    const courseResult = await query(`
      SELECT 
        c.*,
        wi.current_state as workflow_state,
        wi.state_entered_at,
        wi.state_data,
        wt.name as workflow_template_name,
        wt.id as workflow_template_id,
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
        ) FILTER (WHERE cd.depends_on_course_id IS NOT NULL) as dependencies
      FROM courses c
      LEFT JOIN workflow_instances wi ON c.id = wi.course_id AND wi.is_complete = false
      LEFT JOIN workflow_templates wt ON wi.workflow_template_id = wt.id
      LEFT JOIN course_assignments ca ON c.id = ca.course_id
      LEFT JOIN users u ON ca.user_id = u.id
      LEFT JOIN course_dependencies cd ON c.id = cd.course_id
      LEFT JOIN courses dc ON cd.depends_on_course_id = dc.id
      WHERE c.id = $1
      GROUP BY c.id, wi.current_state, wi.state_entered_at, wi.state_data, wt.name, wt.id
    `, [id]);

    if (courseResult.rows.length === 0) {
      throw new NotFoundError('Course not found');
    }

    const course = courseResult.rows[0];

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
    const allowedFields = ['title', 'description', 'type', 'priority', 'status', 'startDate', 'dueDate', 'estimatedHours', 'estimatedDailyHours', 'metadata'];
    
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

    // Validate input
    const { error, value } = subtaskSchema.validate(req.body);
    if (error) {
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
}

module.exports = new CourseController();