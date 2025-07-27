const express = require('express');
const { getConnection } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/auth');
const { validateUserUpdate, validateNotificationSettings } = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
router.get('/profile', asyncHandler(async (req, res) => {
  const db = getConnection();

  // Get user details with settings
  const [users] = await db.execute(`
    SELECT 
      u.id, u.email, u.first_name, u.last_name, u.phone_number, u.user_type, 
      u.is_active, u.created_at, u.updated_at,
      us.notification_whatsapp, us.notification_email, us.notification_frequency, us.timezone
    FROM users u
    LEFT JOIN user_settings us ON u.id = us.user_id
    WHERE u.id = ?
  `, [req.user.id]);

  if (users.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  const user = users[0];

  // Get user's groups if they are a group admin or member
  const [groups] = await db.execute(`
    SELECT DISTINCT g.id, g.name, g.description, g.admin_id,
           CASE
             WHEN g.admin_id = ? THEN 'admin'
             ELSE gm.role
           END as user_role
    FROM \`groups\` g
    LEFT JOIN group_members gm ON g.id = gm.group_id AND gm.user_id = ?
    WHERE g.admin_id = ? OR gm.user_id = ?
    ORDER BY g.name
  `, [req.user.id, req.user.id, req.user.id, req.user.id]);

  // Get task statistics
  const [taskStats] = await db.execute(`
    SELECT 
      COUNT(*) as total_tasks,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tasks,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
      SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_tasks
    FROM tasks 
    WHERE assigned_to = ? AND is_active = true
  `, [req.user.id]);

  res.json({
    success: true,
    data: {
      user: {
        ...user,
        groups,
        task_statistics: taskStats[0],
      },
    },
  });
}));

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
router.put('/profile', validateUserUpdate, asyncHandler(async (req, res) => {
  const { first_name, last_name, phone_number } = req.body;
  const db = getConnection();

  // Build update query dynamically
  const updateFields = [];
  const updateValues = [];

  if (first_name !== undefined) {
    updateFields.push('first_name = ?');
    updateValues.push(first_name);
  }

  if (last_name !== undefined) {
    updateFields.push('last_name = ?');
    updateValues.push(last_name);
  }

  if (phone_number !== undefined) {
    updateFields.push('phone_number = ?');
    updateValues.push(phone_number);
  }

  if (updateFields.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No fields to update',
    });
  }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  updateValues.push(req.user.id);

  await db.execute(
    `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
    updateValues
  );

  // Get updated user data
  const [users] = await db.execute(
    'SELECT id, email, first_name, last_name, phone_number, user_type FROM users WHERE id = ?',
    [req.user.id]
  );

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: users[0],
    },
  });
}));

// @desc    Get notification settings
// @route   GET /api/users/notification-settings
// @access  Private
router.get('/notification-settings', asyncHandler(async (req, res) => {
  const db = getConnection();

  const [settings] = await db.execute(
    'SELECT notification_whatsapp, notification_email, notification_frequency, timezone FROM user_settings WHERE user_id = ?',
    [req.user.id]
  );

  if (settings.length === 0) {
    // Create default settings if they don't exist
    await db.execute(
      'INSERT INTO user_settings (user_id) VALUES (?)',
      [req.user.id]
    );

    return res.json({
      success: true,
      data: {
        notification_whatsapp: true,
        notification_email: true,
        notification_frequency: 60,
        timezone: 'UTC',
      },
    });
  }

  res.json({
    success: true,
    data: settings[0],
  });
}));

// @desc    Update notification settings
// @route   PUT /api/users/notification-settings
// @access  Private
router.put('/notification-settings', validateNotificationSettings, asyncHandler(async (req, res) => {
  const { notification_whatsapp, notification_email, notification_frequency, timezone } = req.body;
  const db = getConnection();

  // Build update query dynamically
  const updateFields = [];
  const updateValues = [];

  if (notification_whatsapp !== undefined) {
    updateFields.push('notification_whatsapp = ?');
    updateValues.push(notification_whatsapp);
  }

  if (notification_email !== undefined) {
    updateFields.push('notification_email = ?');
    updateValues.push(notification_email);
  }

  if (notification_frequency !== undefined) {
    updateFields.push('notification_frequency = ?');
    updateValues.push(notification_frequency);
  }

  if (timezone !== undefined) {
    updateFields.push('timezone = ?');
    updateValues.push(timezone);
  }

  if (updateFields.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No settings to update',
    });
  }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  updateValues.push(req.user.id);

  // Check if settings exist
  const [existingSettings] = await db.execute(
    'SELECT id FROM user_settings WHERE user_id = ?',
    [req.user.id]
  );

  if (existingSettings.length === 0) {
    // Create new settings
    await db.execute(
      `INSERT INTO user_settings (user_id, ${updateFields.slice(0, -1).map(field => field.split(' = ')[0]).join(', ')}) 
       VALUES (?, ${updateValues.slice(0, -1).map(() => '?').join(', ')})`,
      [req.user.id, ...updateValues.slice(0, -1)]
    );
  } else {
    // Update existing settings
    await db.execute(
      `UPDATE user_settings SET ${updateFields.join(', ')} WHERE user_id = ?`,
      updateValues
    );
  }

  // Get updated settings
  const [settings] = await db.execute(
    'SELECT notification_whatsapp, notification_email, notification_frequency, timezone FROM user_settings WHERE user_id = ?',
    [req.user.id]
  );

  res.json({
    success: true,
    message: 'Notification settings updated successfully',
    data: settings[0],
  });
}));

// @desc    Get user dashboard data
// @route   GET /api/users/dashboard
// @access  Private
router.get('/dashboard', asyncHandler(async (req, res) => {
  const db = getConnection();

  const userId = req.user.id;

  // Get all group IDs where the user is an admin or member
  const [adminGroupRows] = await db.execute('SELECT id FROM `groups` WHERE admin_id = ? AND is_active = true', [userId]);
  const adminGroupIds = adminGroupRows.map(r => r.id);

  const [memberGroupRows] = await db.execute('SELECT group_id FROM group_members WHERE user_id = ?', [userId]);
  const memberGroupIds = memberGroupRows.map(r => r.group_id);
  
  const accessibleGroupIds = [...new Set([...adminGroupIds, ...memberGroupIds])];

  // Build the authorization part of the WHERE clause
  let authWhereClause = '(t.assigned_to = ?)';
  const authParams = [userId];
  if (accessibleGroupIds.length > 0) {
    const placeholders = accessibleGroupIds.map(() => '?').join(',');
    authWhereClause += ` OR t.group_id IN (${placeholders})`;
    authParams.push(...accessibleGroupIds);
  }

  // Get recent tasks
  const [recentTasks] = await db.execute(`
    SELECT t.id, t.title, t.status, t.priority, t.start_time, t.end_time,
           u.first_name AS created_by_name, g.name AS group_name
    FROM tasks t
    LEFT JOIN users u ON t.created_by = u.id
    LEFT JOIN \`groups\` g ON t.group_id = g.id
    WHERE t.is_active = TRUE AND (${authWhereClause})
    ORDER BY t.created_at DESC
    LIMIT 10
  `, authParams);

  // Get upcoming tasks (next 7 days)
  const [upcomingTasks] = await db.execute(`
    SELECT t.id, t.title, t.status, t.priority, t.start_time, t.end_time,
           u.first_name AS created_by_name, g.name AS group_name
    FROM tasks t
    LEFT JOIN users u ON t.created_by = u.id
    LEFT JOIN \`groups\` g ON t.group_id = g.id
    WHERE t.is_active = TRUE AND (${authWhereClause})
          AND t.start_time BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)
          AND t.status IN ('pending', 'in_progress')
    ORDER BY t.start_time ASC
    LIMIT 10
  `, authParams);

  // Get overdue tasks
  const [overdueTasks] = await db.execute(`
    SELECT t.id, t.title, t.status, t.priority, t.start_time, t.end_time,
           u.first_name AS created_by_name, g.name AS group_name
    FROM tasks t
    LEFT JOIN users u ON t.created_by = u.id
    LEFT JOIN \`groups\` g ON t.group_id = g.id
    WHERE t.is_active = TRUE AND (${authWhereClause})
          AND t.end_time < NOW() AND t.status != 'completed'
    ORDER BY t.end_time ASC
    LIMIT 10
  `, authParams);

  // Get task statistics by priority
  const [priorityStats] = await db.execute(`
    SELECT
      priority,
      COUNT(*) as count,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count
    FROM tasks t
    WHERE t.is_active = true AND (${authWhereClause})
    GROUP BY priority
  `, authParams);

  // Get completion rate for last 30 days
  const [completionStats] = await db.execute(`
    SELECT
      DATE(t.created_at) as date,
      COUNT(*) as total_tasks,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks
    FROM tasks t
    WHERE t.is_active = true AND (${authWhereClause})
          AND t.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY DATE(t.created_at)
    ORDER BY date DESC
  `, authParams);

  res.json({
    success: true,
    data: {
      recent_tasks: recentTasks,
      upcoming_tasks: upcomingTasks,
      overdue_tasks: overdueTasks,
      priority_statistics: priorityStats,
      completion_statistics: completionStats,
    },
  });
}));

// @desc    Search users (for group admins to add members)
// @route   GET /api/users/search
// @access  Private
router.get('/search', asyncHandler(async (req, res) => {
  const { q, limit = 10 } = req.query;

  // Validate search query
  if (!q || q.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Search query must be at least 2 characters long',
    });
  }

  // Validate user ID
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: User ID not found',
    });
  }

  const db = getConnection();
  const searchTerm = `%${q.trim()}%`;
  const queryLimit = Math.max(1, Math.min(parseInt(limit) || 10, 100)); // Ensure valid integer

  // Log parameters for debugging
  console.log('Query parameters:', [searchTerm, searchTerm, searchTerm, req.user.id, queryLimit]);

  const [users] = await db.execute(`
  SELECT id, email, first_name, last_name, user_type
FROM users
WHERE is_active = true
      AND (email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)
      AND id != ?
ORDER BY first_name, last_name
LIMIT ?
  `, [searchTerm, searchTerm, searchTerm, req.user.id, queryLimit]);

  res.json({
    success: true,
    data: {
      users,
    },
  });
}));

module.exports = router;