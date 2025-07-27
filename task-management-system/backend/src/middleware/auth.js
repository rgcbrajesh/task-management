const jwt = require('jsonwebtoken');
const { getConnection } = require('../config/database');

// ✅ Middleware: Authenticate Token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    console.log("🔐 Auth Header:", authHeader);
    console.log("🧾 Extracted Token:", token ? token.substring(0, 20) + '...' : 'No token');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
      });
    }

    // Check if JWT_SECRET is available
    if (!process.env.JWT_SECRET) {
      console.error('❌ JWT_SECRET not found in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("✅ Decoded Token:", { userId: decoded.userId, email: decoded.email });

    const db = getConnection();
    const [users] = await db.execute(
      'SELECT id, email, first_name, last_name, user_type, is_active FROM users WHERE id = ? AND is_active = true',
      [decoded.userId]
    );

    if (users.length === 0) {
      console.log("🚫 User not found or inactive");
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user not found',
      });
    }

    req.user = users[0];
    console.log("✅ Authenticated User:", { id: req.user.id, email: req.user.email });
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error.message);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format',
        debug: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ✅ Middleware: Admin Access Required
const requireAdmin = async (req, res, next) => {
  try {
    console.log("🔐 Checking Admin Access: ", req.user.user_type);
    if (req.user.user_type !== 'group_admin') {
      console.log("🚫 Not an admin");
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }
    console.log("✅ Admin Access Granted");
    next();
  } catch (error) {
    console.error('❌ Admin middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
// ✅ Middleware: Super Admin Access Required
const requireSuperAdmin = async (req, res, next) => {
  try {
    console.log("🔐 Checking Super Admin Access: ", req.user.user_type);
    if (req.user.user_type !== 'superadmin' || 'group_admin') {
      console.log("🚫 Not a superadmin");
      return res.status(403).json({
        success: false,
        message: 'Superadmin access required',
      });
    }
    console.log("✅ Super Admin Access Granted");
    next();
  } catch (error) {
    console.error('❌ Super admin middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// ✅ Middleware: Group Member Check
const requireGroupMember = async (req, res, next) => {
  try {
    const groupId = req.params.id || req.params.groupId || req.body.groupId;

    console.log("📦 Checking group membership...");
    console.log("👉 User ID:", req.user.id, "Group ID:", groupId);

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Group ID required',
      });
    }

    const db = getConnection();

    const [membership] = await db.execute(`
      SELECT gm.role, g.admin_id
      FROM group_members gm
      JOIN \`groups\` g ON gm.group_id = g.id
      WHERE gm.group_id = ? AND gm.user_id = ?
    `, [groupId, req.user.id]);

    const [groupInfo] = await db.execute(
      'SELECT admin_id FROM `groups` WHERE id = ?',
      [groupId]
    );

    console.log("🧾 Membership:", membership);
    console.log("📋 Group Info:", groupInfo);

    if (membership.length > 0 || (groupInfo.length > 0 && groupInfo[0].admin_id === req.user.id)) {
      req.userRole = membership.length > 0 ? membership[0].role : 'admin';
      req.isGroupAdmin = groupInfo.length > 0 && groupInfo[0].admin_id === req.user.id;
      console.log("✅ Group Access Granted");
      next();
    } else {
      console.log("🚫 Not a group member or admin");
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a member of this group.',
      });
    }
  } catch (error) {
    console.error('❌ Group member middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// ✅ Middleware: Task Access Check
const requireTaskAccess = async (req, res, next) => {
  try {
    const taskId = req.params.taskId || req.params.id;

    console.log("📦 Task Access Check - Task ID:", taskId);

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: 'Task ID required',
      });
    }

    const db = getConnection();

    const [tasks] = await db.execute(`
      SELECT t.*, g.admin_id as group_admin_id
      FROM tasks t
      LEFT JOIN \`groups\` g ON t.group_id = g.id
      WHERE t.id = ? AND t.is_active = true
    `, [taskId]);

    if (tasks.length === 0) {
      console.log("🚫 Task not found or inactive");
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    const task = tasks[0];

    const hasAccess = 
      task.created_by === req.user.id ||
      task.assigned_to === req.user.id ||
      (task.group_admin_id && task.group_admin_id === req.user.id);

    console.log("🧾 Task:", task);
    console.log("👉 User ID:", req.user.id, "Has Access:", hasAccess);

    if (!hasAccess) {
      console.log("🚫 Task access denied");
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to access this task.',
      });
    }

    req.task = task;
    console.log("✅ Task Access Granted");
    next();
  } catch (error) {
    console.error('❌ Task access middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireSuperAdmin,
  requireGroupMember,
  requireTaskAccess,
};
