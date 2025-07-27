const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getConnection } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateUserRegistration, validateUserLogin } = require('../middleware/validation');

const router = express.Router();

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', validateUserRegistration, asyncHandler(async (req, res) => {
  const { email, password, first_name, last_name, phone_number, user_type } = req.body;

  const db = getConnection();

  // Check if user already exists
  const [existingUsers] = await db.execute(
    'SELECT id FROM users WHERE email = ?',
    [email]
  );

  if (existingUsers.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'User with this email already exists',
    });
  }

  // Hash password
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Create user
  const [result] = await db.execute(
    `INSERT INTO users (email, password, first_name, last_name, phone_number, user_type)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [email, hashedPassword, first_name, last_name, phone_number || null, user_type]
  );

  // Create user settings
  await db.execute(
    'INSERT INTO user_settings (user_id) VALUES (?)',
    [result.insertId]
  );
console.log("JWT_SECRET loaded:", process.env.JWT_SECRET);

  // Generate JWT token
  const token = jwt.sign(
    { userId: result.insertId, email, user_type },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: result.insertId,
        email,
        first_name,
        last_name,
        phone_number,
        user_type,
      },
      token,
    },
  });
}));

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', validateUserLogin, asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const db = getConnection();

  // Get user by email
  const [users] = await db.execute(
    'SELECT id, email, password, first_name, last_name, phone_number, user_type, is_active FROM users WHERE email = ?',
    [email]
  );

  if (users.length === 0) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password',
    });
  }

  const user = users[0];

  // Check if user is active
  if (!user.is_active) {
    return res.status(401).json({
      success: false,
      message: 'Account is deactivated. Please contact support.',
    });
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password',
    });
  }

  // Generate JWT token
  const token = jwt.sign(
    { userId: user.id, email: user.email, user_type: user.user_type },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  // Update last login (optional)
  await db.execute(
    'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [user.id]
  );

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone_number: user.phone_number,
        user_type: user.user_type,
      },
      token,
    },
  });
}));

// @desc    Verify token
// @route   POST /api/auth/verify
// @access  Public
router.post('/verify', asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'Token is required',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const db = getConnection();
    const [users] = await db.execute(
      'SELECT id, email, first_name, last_name, phone_number, user_type, is_active FROM users WHERE id = ? AND is_active = true',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user not found',
      });
    }

    res.json({
      success: true,
      message: 'Token is valid',
      data: {
        user: users[0],
      },
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
      });
    }

    throw error;
  }
}));

// @desc    Refresh token
// @route   POST /api/auth/refresh
// @access  Public
router.post('/refresh', asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'Token is required',
    });
  }

  try {
    // Verify the token even if it's expired
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
    
    const db = getConnection();
    const [users] = await db.execute(
      'SELECT id, email, first_name, last_name, phone_number, user_type, is_active FROM users WHERE id = ? AND is_active = true',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user not found',
      });
    }

    const user = users[0];

    // Generate new token
    const newToken = jwt.sign(
      { userId: user.id, email: user.email, user_type: user.user_type },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        user,
        token: newToken,
      },
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }

    throw error;
  }
}));

// @desc    Change password
// @route   POST /api/auth/change-password
// @access  Private
const { authenticateToken } = require('../middleware/auth');

router.post('/change-password', authenticateToken, asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({
      success: false,
      message: 'Current password and new password are required',
    });
  }

  // Validate new password
  if (new_password.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 8 characters long',
    });
  }

  const db = getConnection();

  // Get current user password
  const [users] = await db.execute(
    'SELECT password FROM users WHERE id = ?',
    [req.user.id]
  );

  if (users.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Verify current password
  const isCurrentPasswordValid = await bcrypt.compare(current_password, users[0].password);

  if (!isCurrentPasswordValid) {
    return res.status(400).json({
      success: false,
      message: 'Current password is incorrect',
    });
  }

  // Hash new password
  const saltRounds = 12;
  const hashedNewPassword = await bcrypt.hash(new_password, saltRounds);

  // Update password
  await db.execute(
    'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [hashedNewPassword, req.user.id]
  );

  res.json({
    success: true,
    message: 'Password changed successfully',
  });
}));

module.exports = router;