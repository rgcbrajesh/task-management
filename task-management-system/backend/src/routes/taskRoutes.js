const express = require('express');
const mysql = require('mysql2');
const { getConnection } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken, requireTaskAccess } = require('../middleware/auth');
const { 
  validateTaskCreation, 
  validateTaskUpdate, 
  validateTaskStatusUpdate,
  validateIdParam,
  validateTaskIdParam,
  validatePagination,
  validateTaskFilters 
} = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// @desc    Create a new task
// @route   POST /api/tasks
// @access  Private
router.post('/', validateTaskCreation, asyncHandler(async (req, res) => {
  const { 
    title, 
    description, 
    start_time, 
    end_time, 
    priority = 'medium', 
    assigned_to, 
    group_id 
  } = req.body;
  
  const db = getConnection();

  // Determine who the task is assigned to
  let assignedUserId = assigned_to || req.user.id;

  // If group_id is provided, validate group membership and assignment
  if (group_id) {
    // Check if user is admin of the group or a member
    const [groupCheck] = await db.execute(
      'SELECT admin_id FROM `groups` WHERE id = ? AND is_active = true',
      [group_id]
    );

    if (groupCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
      });
    }

    const isGroupAdmin = groupCheck[0].admin_id === req.user.id;

    const [memberCheck] = await db.execute(
      'SELECT user_id FROM group_members WHERE group_id = ? AND user_id = ?',
      [group_id, req.user.id]
    );

    const isGroupMember = memberCheck.length > 0;

    if (!isGroupAdmin && !isGroupMember) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this group and cannot create tasks for it',
      });
    }

    // If assigning to someone else, check if they are group members
    if (assigned_to && assigned_to !== req.user.id) {
      if (!isGroupAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Only group admin can assign tasks to other members',
        });
      }

      const [assigneeCheck] = await db.execute(`
        SELECT gm.user_id
        FROM group_members gm
        WHERE gm.group_id = ? AND gm.user_id = ?
        UNION
        SELECT admin_id as user_id FROM \`groups\` WHERE id = ? AND admin_id = ?
      `, [group_id, assigned_to, group_id, assigned_to]);

      if (assigneeCheck.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Assigned user is not a member of this group',
        });
      }
    }
  } else {
    // For individual tasks, can only assign to self
    if (assigned_to && assigned_to !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Individual users can only assign tasks to themselves',
      });
    }
  }

  // Validate time range
  const startTime = new Date(start_time);
  const endTime = new Date(end_time);
  
  if (endTime <= startTime) {
    return res.status(400).json({
      success: false,
      message: 'End time must be after start time',
    });
  }

  // Format dates for MySQL DATETIME format
  const formatDateTime = (dateString) => {
    return new Date(dateString).toISOString().slice(0, 19).replace('T', ' ');
  };

  const formattedStartTime = formatDateTime(start_time);
  const formattedEndTime = formatDateTime(end_time);

  // Create task
  const [result] = await db.execute(`
    INSERT INTO tasks (title, description, start_time, end_time, priority, created_by, assigned_to, group_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [title, description, formattedStartTime, formattedEndTime, priority, req.user.id, assignedUserId, group_id]);

  // Log task creation
  await db.execute(`
    INSERT INTO task_updates (task_id, user_id, old_status, new_status, notes)
    VALUES (?, ?, NULL, 'pending', 'Task created')
  `, [result.insertId, req.user.id]);

  // Get created task with related data
  const [tasks] = await db.execute(`
    SELECT t.*,
           creator.first_name as created_by_name,
           assignee.first_name as assigned_to_name,
           g.name as group_name
    FROM tasks t
    LEFT JOIN users creator ON t.created_by = creator.id
    LEFT JOIN users assignee ON t.assigned_to = assignee.id
    LEFT JOIN \`groups\` g ON t.group_id = g.id
    WHERE t.id = ?
  `, [result.insertId]);

  res.status(201).json({
    success: true,
    message: 'Task created successfully',
    data: {
      task: tasks[0],
    },
  });
}));

// @desc    Get all tasks for the user
// @route   GET /api/tasks
// @access  Private
router.get('/', validatePagination, validateTaskFilters, asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    status, 
    priority, 
    start_date, 
    end_date, 
    assigned_to, 
    group_id,
    sort_by = 'created_at',
    sort_order = 'DESC'
  } = req.query;
  
  const offset = (page - 1) * limit;
  const db = getConnection();

  // Build WHERE clause
  const whereConditions = ['t.is_active = true'];
  const queryParams = [];
  const userId = req.user.id;

  // Get all group IDs where the user is an admin or member
  const [adminGroupRows] = await db.execute('SELECT id FROM `groups` WHERE admin_id = ? AND is_active = true', [userId]);
  const adminGroupIds = adminGroupRows.map(r => r.id);

  const [memberGroupRows] = await db.execute('SELECT group_id FROM group_members WHERE user_id = ?', [userId]);
  const memberGroupIds = memberGroupRows.map(r => r.group_id);
  
  const accessibleGroupIds = [...new Set([...adminGroupIds, ...memberGroupIds])];

  // Build authorization conditions
  const authConditions = ['t.created_by = ?', 't.assigned_to = ?'];
  queryParams.push(userId, userId);

  if (accessibleGroupIds.length > 0) {
    authConditions.push(`t.group_id IN (${mysql.escape(accessibleGroupIds)})`);
  }
  
  whereConditions.push(`(${authConditions.join(' OR ')})`);

  if (status) {
    whereConditions.push('t.status = ?');
    queryParams.push(status);
  }

  if (priority) {
    whereConditions.push('t.priority = ?');
    queryParams.push(priority);
  }

  if (start_date) {
    whereConditions.push('t.start_time >= ?');
    queryParams.push(start_date);
  }

  if (end_date) {
    whereConditions.push('t.end_time <= ?');
    queryParams.push(end_date);
  }

  if (assigned_to) {
    whereConditions.push('t.assigned_to = ?');
    queryParams.push(assigned_to);
  }

  if (group_id) {
    whereConditions.push('t.group_id = ?');
    queryParams.push(group_id);
  }

  // Validate sort parameters
  const validSortFields = ['created_at', 'start_time', 'end_time', 'priority', 'status', 'title'];
  const validSortOrders = ['ASC', 'DESC'];
  
  const sortField = validSortFields.includes(sort_by) ? sort_by : 'created_at';
  const sortDirection = validSortOrders.includes(sort_order.toUpperCase()) ? sort_order.toUpperCase() : 'DESC';

  // Get tasks
  const [tasks] = await db.query(`
    SELECT t.*,
           creator.first_name as created_by_name,
           assignee.first_name as assigned_to_name,
           assignee.last_name as assigned_to_last_name,
           g.name as group_name
    FROM tasks t
    LEFT JOIN users creator ON t.created_by = creator.id
    LEFT JOIN users assignee ON t.assigned_to = assignee.id
    LEFT JOIN \`groups\` g ON t.group_id = g.id
    WHERE ${whereConditions.join(' AND ')}
    ORDER BY t.${sortField} ${sortDirection}
    LIMIT ? OFFSET ?
  `, [...queryParams, parseInt(limit), parseInt(offset)]);

  // Get total count
  const [countResult] = await db.query(`
    SELECT COUNT(*) as total
    FROM tasks t
    WHERE ${whereConditions.join(' AND ')}
  `, queryParams);

  const total = countResult[0].total;
  const totalPages = Math.ceil(total / limit);

  res.json({
    success: true,
    data: {
      tasks,
      pagination: {
        current_page: parseInt(page),
        total_pages: totalPages,
        total_items: total,
        items_per_page: parseInt(limit),
      },
    },
  });
}));

// @desc    Get task by ID
// @route   GET /api/tasks/:id
// @access  Private (Task access required)
router.get('/:id', validateIdParam, requireTaskAccess, asyncHandler(async (req, res) => {
  const taskId = req.params.id;
  const db = getConnection();

  // Get task with all related data
  const [tasks] = await db.execute(`
    SELECT t.*,
           creator.first_name as created_by_name,
           creator.last_name as created_by_last_name,
           assignee.first_name as assigned_to_name,
           assignee.last_name as assigned_to_last_name,
           assignee.email as assigned_to_email,
           g.name as group_name,
           g.admin_id as group_admin_id
    FROM tasks t
    LEFT JOIN users creator ON t.created_by = creator.id
    LEFT JOIN users assignee ON t.assigned_to = assignee.id
    LEFT JOIN \`groups\` g ON t.group_id = g.id
    WHERE t.id = ? AND t.is_active = true
  `, [taskId]);

  if (tasks.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Task not found',
    });
  }

  // Get task update history
  const [updates] = await db.execute(`
    SELECT tu.*, u.first_name, u.last_name
    FROM task_updates tu
    LEFT JOIN users u ON tu.user_id = u.id
    WHERE tu.task_id = ?
    ORDER BY tu.created_at DESC
  `, [taskId]);

  res.json({
    success: true,
    data: {
      task: {
        ...tasks[0],
        updates,
      },
    },
  });
}));

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private (Task access required)
router.put('/:id', validateIdParam, validateTaskUpdate, requireTaskAccess, asyncHandler(async (req, res) => {
  const taskId = req.params.id;
  const { title, description, start_time, end_time, priority, status, assigned_to } = req.body;
  const db = getConnection();

  const task = req.task; // From requireTaskAccess middleware

  // Check permissions for different updates
  const isCreator = task.created_by === req.user.id;
  const isAssignee = task.assigned_to === req.user.id;
  const isGroupAdmin = task.group_admin_id === req.user.id;

  // Only creator, assignee, or group admin can update tasks
  if (!isCreator && !isAssignee && !isGroupAdmin) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to update this task',
    });
  }

  // Build update query dynamically
  const updateFields = [];
  const updateValues = [];
  const oldValues = {};

  if (title !== undefined) {
    updateFields.push('title = ?');
    updateValues.push(title);
    oldValues.title = task.title;
  }

  if (description !== undefined) {
    updateFields.push('description = ?');
    updateValues.push(description);
    oldValues.description = task.description;
  }

  if (start_time !== undefined) {
    updateFields.push('start_time = ?');
    updateValues.push(start_time);
    oldValues.start_time = task.start_time;
  }

  if (end_time !== undefined) {
    updateFields.push('end_time = ?');
    updateValues.push(end_time);
    oldValues.end_time = task.end_time;
  }

  if (priority !== undefined) {
    updateFields.push('priority = ?');
    updateValues.push(priority);
    oldValues.priority = task.priority;
  }

  if (status !== undefined) {
    updateFields.push('status = ?');
    updateValues.push(status);
    oldValues.status = task.status;
  }

  // Only creator or group admin can reassign tasks
  if (assigned_to !== undefined) {
    if (!isCreator && !isGroupAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only task creator or group admin can reassign tasks',
      });
    }

    // If task belongs to a group, validate assignee is a group member
    if (task.group_id) {
      const [assigneeCheck] = await db.execute(`
        SELECT gm.user_id
        FROM group_members gm
        WHERE gm.group_id = ? AND gm.user_id = ?
        UNION
        SELECT admin_id as user_id FROM \`groups\` WHERE id = ? AND admin_id = ?
      `, [task.group_id, assigned_to, task.group_id, assigned_to]);

      if (assigneeCheck.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Assigned user is not a member of this group',
        });
      }
    }

    updateFields.push('assigned_to = ?');
    updateValues.push(assigned_to);
    oldValues.assigned_to = task.assigned_to;
  }

  if (updateFields.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No fields to update',
    });
  }

  // Validate time range if both times are being updated
  if (start_time !== undefined && end_time !== undefined) {
    if (new Date(end_time) <= new Date(start_time)) {
      return res.status(400).json({
        success: false,
        message: 'End time must be after start time',
      });
    }
  }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  updateValues.push(taskId);

  // Update task
  await db.execute(
    `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`,
    updateValues
  );

  // Log the update
  const updateNotes = Object.keys(oldValues).map(key => 
    `${key}: ${oldValues[key]} → ${req.body[key]}`
  ).join(', ');

  await db.execute(`
    INSERT INTO task_updates (task_id, user_id, old_status, new_status, notes)
    VALUES (?, ?, ?, ?, ?)
  `, [taskId, req.user.id, oldValues.status || task.status, status || task.status, updateNotes]);

  // Get updated task
  const [updatedTasks] = await db.execute(`
    SELECT t.*,
           creator.first_name as created_by_name,
           assignee.first_name as assigned_to_name,
           g.name as group_name
    FROM tasks t
    LEFT JOIN users creator ON t.created_by = creator.id
    LEFT JOIN users assignee ON t.assigned_to = assignee.id
    LEFT JOIN \`groups\` g ON t.group_id = g.id
    WHERE t.id = ?
  `, [taskId]);

  res.json({
    success: true,
    message: 'Task updated successfully',
    data: {
      task: updatedTasks[0],
    },
  });
}));

// @desc    Update task status
// @route   PUT /api/tasks/:id/status
// @access  Private (Task access required)
router.put('/:id/status', validateTaskIdParam, validateTaskStatusUpdate, requireTaskAccess, asyncHandler(async (req, res) => {
  const taskId = req.params.id;
  const { status, notes } = req.body;
  const db = getConnection();

  const task = req.task; // From requireTaskAccess middleware

  // Check if user can update status (assignee or creator or group admin)
  const canUpdateStatus = 
    task.assigned_to === req.user.id || 
    task.created_by === req.user.id || 
    (task.group_admin_id && task.group_admin_id === req.user.id);

  if (!canUpdateStatus) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to update this task status',
    });
  }

  const oldStatus = task.status;

  // Update task status
  await db.execute(
    'UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, taskId]
  );

  // Log status update
  await db.execute(`
    INSERT INTO task_updates (task_id, user_id, old_status, new_status, notes)
    VALUES (?, ?, ?, ?, ?)
  `, [taskId, req.user.id, oldStatus, status, notes || `Status changed from ${oldStatus} to ${status}`]);

  // Get updated task
  const [updatedTasks] = await db.execute(`
    SELECT t.*,
           creator.first_name as created_by_name,
           assignee.first_name as assigned_to_name,
           g.name as group_name
    FROM tasks t
    LEFT JOIN users creator ON t.created_by = creator.id
    LEFT JOIN users assignee ON t.assigned_to = assignee.id
    LEFT JOIN \`groups\` g ON t.group_id = g.id
    WHERE t.id = ?
  `, [taskId]);

  res.json({
    success: true,
    message: 'Task status updated successfully',
    data: {
      task: updatedTasks[0],
    },
  });
}));

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private (Task creator or group admin only)
router.delete('/:id', validateIdParam, requireTaskAccess, asyncHandler(async (req, res) => {
  const taskId = req.params.id;
  const db = getConnection();

  const task = req.task; // From requireTaskAccess middleware

  // Only creator or group admin can delete tasks
  const canDelete = 
    task.created_by === req.user.id || 
    (task.group_admin_id && task.group_admin_id === req.user.id);

  if (!canDelete) {
    return res.status(403).json({
      success: false,
      message: 'Only task creator or group admin can delete tasks',
    });
  }

  // Soft delete task
  await db.execute(
    'UPDATE tasks SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [taskId]
  );

  // Log deletion
  await db.execute(`
    INSERT INTO task_updates (task_id, user_id, old_status, new_status, notes)
    VALUES (?, ?, ?, NULL, 'Task deleted')
  `, [taskId, req.user.id, task.status]);

  res.json({
    success: true,
    message: 'Task deleted successfully',
  });
}));

module.exports = router;