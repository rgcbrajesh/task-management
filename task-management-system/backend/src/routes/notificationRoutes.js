const express = require('express');
const { getConnection } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/auth');
const { validatePagination } = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// @desc    Get notification logs for user
// @route   GET /api/notifications/logs
// @access  Private
router.get('/logs', validatePagination, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, type } = req.query;
  const offset = (page - 1) * limit;
  const db = getConnection();

  // Build WHERE clause
  const whereConditions = ['nl.user_id = ?'];
  const queryParams = [req.user.id];

  if (status) {
    whereConditions.push('nl.status = ?');
    queryParams.push(status);
  }

  if (type) {
    whereConditions.push('nl.notification_type = ?');
    queryParams.push(type);
  }

  // Get notification logs
  const [logs] = await db.execute(`
    SELECT nl.*, t.title as task_title, t.status as task_status
    FROM notification_logs nl
    LEFT JOIN tasks t ON nl.task_id = t.id
    WHERE ${whereConditions.join(' AND ')}
    ORDER BY nl.created_at DESC
    LIMIT ? OFFSET ?
  `, [...queryParams, parseInt(limit), parseInt(offset)]);

  // Get total count
  const [countResult] = await db.execute(`
    SELECT COUNT(*) as total
    FROM notification_logs nl
    WHERE ${whereConditions.join(' AND ')}
  `, queryParams);

  const total = countResult[0].total;
  const totalPages = Math.ceil(total / limit);

  res.json({
    success: true,
    data: {
      logs,
      pagination: {
        current_page: parseInt(page),
        total_pages: totalPages,
        total_items: total,
        items_per_page: parseInt(limit),
      },
    },
  });
}));

// @desc    Get notification statistics
// @route   GET /api/notifications/stats
// @access  Private
router.get('/stats', asyncHandler(async (req, res) => {
  const db = getConnection();

  // Get notification statistics for the user
  const [stats] = await db.execute(`
    SELECT 
      COUNT(*) as total_notifications,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_notifications,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_notifications,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_notifications,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_notifications,
      SUM(CASE WHEN notification_type = 'whatsapp' THEN 1 ELSE 0 END) as whatsapp_notifications,
      SUM(CASE WHEN notification_type = 'email' THEN 1 ELSE 0 END) as email_notifications,
      SUM(CASE WHEN notification_type = 'sms' THEN 1 ELSE 0 END) as sms_notifications
    FROM notification_logs 
    WHERE user_id = ?
  `, [req.user.id]);

  // Get recent notification activity (last 30 days)
  const [recentActivity] = await db.execute(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as total_notifications,
      SUM(CASE WHEN status = 'sent' OR status = 'delivered' THEN 1 ELSE 0 END) as successful_notifications,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_notifications
    FROM notification_logs 
    WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `, [req.user.id]);

  // Get notification performance by type
  const [typePerformance] = await db.execute(`
    SELECT 
      notification_type,
      COUNT(*) as total_sent,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_count,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
      AVG(CASE WHEN sent_at IS NOT NULL AND delivered_at IS NOT NULL 
          THEN TIMESTAMPDIFF(SECOND, sent_at, delivered_at) 
          ELSE NULL END) as avg_delivery_time_seconds
    FROM notification_logs 
    WHERE user_id = ? AND status IN ('sent', 'delivered', 'failed')
    GROUP BY notification_type
  `, [req.user.id]);

  res.json({
    success: true,
    data: {
      overall_stats: stats[0],
      recent_activity: recentActivity,
      type_performance: typePerformance,
    },
  });
}));

// @desc    Test notification (send a test notification)
// @route   POST /api/notifications/test
// @access  Private
router.post('/test', asyncHandler(async (req, res) => {
  const { type = 'whatsapp', message = 'This is a test notification from Task Management System' } = req.body;
  
  if (!['whatsapp', 'email', 'sms'].includes(type)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid notification type. Must be whatsapp, email, or sms',
    });
  }

  const db = getConnection();

  // Get user's notification settings
  const [settings] = await db.execute(
    'SELECT notification_whatsapp, notification_email FROM user_settings WHERE user_id = ?',
    [req.user.id]
  );

  if (settings.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'User notification settings not found',
    });
  }

  const userSettings = settings[0];

  // Check if user has enabled this notification type
  if (type === 'whatsapp' && !userSettings.notification_whatsapp) {
    return res.status(400).json({
      success: false,
      message: 'WhatsApp notifications are disabled for your account',
    });
  }

  if (type === 'email' && !userSettings.notification_email) {
    return res.status(400).json({
      success: false,
      message: 'Email notifications are disabled for your account',
    });
  }

  // Get user's phone number for WhatsApp/SMS
  const [users] = await db.execute(
    'SELECT phone_number, email FROM users WHERE id = ?',
    [req.user.id]
  );

  if (users.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  const user = users[0];

  if ((type === 'whatsapp' || type === 'sms') && !user.phone_number) {
    return res.status(400).json({
      success: false,
      message: 'Phone number is required for WhatsApp/SMS notifications',
    });
  }

  if (type === 'email' && !user.email) {
    return res.status(400).json({
      success: false,
      message: 'Email address is required for email notifications',
    });
  }

  // Create notification log entry
  const [result] = await db.execute(`
    INSERT INTO notification_logs (task_id, user_id, notification_type, message, status)
    VALUES (NULL, ?, ?, ?, 'pending')
  `, [req.user.id, type, message]);

  // Here you would integrate with actual notification services
  // For now, we'll simulate the notification sending
  try {
    // Simulate notification sending delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update notification status to sent
    await db.execute(`
      UPDATE notification_logs 
      SET status = 'sent', sent_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [result.insertId]);

    // Simulate delivery confirmation after another delay
    setTimeout(async () => {
      try {
        await db.execute(`
          UPDATE notification_logs 
          SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `, [result.insertId]);
      } catch (error) {
        console.error('Error updating delivery status:', error);
      }
    }, 2000);

    res.json({
      success: true,
      message: `Test ${type} notification sent successfully`,
      data: {
        notification_id: result.insertId,
        type,
        recipient: type === 'email' ? user.email : user.phone_number,
        message,
      },
    });
  } catch (error) {
    // Update notification status to failed
    await db.execute(`
      UPDATE notification_logs 
      SET status = 'failed', error_message = ? 
      WHERE id = ?
    `, [error.message, result.insertId]);

    return res.status(500).json({
      success: false,
      message: 'Failed to send test notification',
      error: error.message,
    });
  }
}));

// @desc    Retry failed notification
// @route   POST /api/notifications/:id/retry
// @access  Private
router.post('/:id/retry', asyncHandler(async (req, res) => {
  const notificationId = req.params.id;
  const db = getConnection();

  // Get notification details
  const [notifications] = await db.execute(`
    SELECT nl.*, u.phone_number, u.email
    FROM notification_logs nl
    JOIN users u ON nl.user_id = u.id
    WHERE nl.id = ? AND nl.user_id = ?
  `, [notificationId, req.user.id]);

  if (notifications.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found',
    });
  }

  const notification = notifications[0];

  if (notification.status !== 'failed') {
    return res.status(400).json({
      success: false,
      message: 'Only failed notifications can be retried',
    });
  }

  if (notification.retry_count >= 3) {
    return res.status(400).json({
      success: false,
      message: 'Maximum retry attempts reached',
    });
  }

  try {
    // Reset notification status and increment retry count
    await db.execute(`
      UPDATE notification_logs 
      SET status = 'pending', retry_count = retry_count + 1, error_message = NULL
      WHERE id = ?
    `, [notificationId]);

    // Simulate notification sending
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update notification status to sent
    await db.execute(`
      UPDATE notification_logs 
      SET status = 'sent', sent_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [notificationId]);

    res.json({
      success: true,
      message: 'Notification retry initiated successfully',
      data: {
        notification_id: notificationId,
        retry_count: notification.retry_count + 1,
      },
    });
  } catch (error) {
    // Update notification status to failed again
    await db.execute(`
      UPDATE notification_logs 
      SET status = 'failed', error_message = ? 
      WHERE id = ?
    `, [error.message, notificationId]);

    return res.status(500).json({
      success: false,
      message: 'Failed to retry notification',
      error: error.message,
    });
  }
}));

// @desc    Get notification preferences
// @route   GET /api/notifications/preferences
// @access  Private
router.get('/preferences', asyncHandler(async (req, res) => {
  const db = getConnection();

  const [settings] = await db.execute(`
    SELECT us.notification_whatsapp, us.notification_email, us.notification_frequency, us.timezone,
           u.phone_number, u.email
    FROM user_settings us
    JOIN users u ON us.user_id = u.id
    WHERE us.user_id = ?
  `, [req.user.id]);

  if (settings.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Notification preferences not found',
    });
  }

  res.json({
    success: true,
    data: settings[0],
  });
}));

// @desc    Update notification preferences
// @route   PUT /api/notifications/preferences
// @access  Private
router.put('/preferences', asyncHandler(async (req, res) => {
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
    if (notification_frequency < 15 || notification_frequency > 1440) {
      return res.status(400).json({
        success: false,
        message: 'Notification frequency must be between 15 and 1440 minutes',
      });
    }
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
      message: 'No preferences to update',
    });
  }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  updateValues.push(req.user.id);

  await db.execute(
    `UPDATE user_settings SET ${updateFields.join(', ')} WHERE user_id = ?`,
    updateValues
  );

  // Get updated preferences
  const [settings] = await db.execute(`
    SELECT notification_whatsapp, notification_email, notification_frequency, timezone
    FROM user_settings 
    WHERE user_id = ?
  `, [req.user.id]);

  res.json({
    success: true,
    message: 'Notification preferences updated successfully',
    data: settings[0],
  });
}));

module.exports = router;