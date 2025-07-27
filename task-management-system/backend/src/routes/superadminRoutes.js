const express = require('express');
const { getConnection } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication and superadmin access
router.use(authenticateToken);
router.use(requireSuperAdmin);

// @desc    Get all users
// @route   GET /api/superadmin/users
// @access  Private (Superadmin only)
router.get('/users', asyncHandler(async (req, res) => {
  const db = getConnection();
  const [users] = await db.execute('SELECT id, email, password FROM users');
  res.json({
    success: true,
    data: {
      users,
    },
  });
}));

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// @desc    Reset user password
// @route   POST /api/superadmin/users/:id/reset-password
// @access  Private (Superadmin only)
router.post('/users/:id/reset-password', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const db = getConnection();

  // Generate a new random password
  const newPassword = crypto.randomBytes(8).toString('hex');
  
  // Hash the new password
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

  // Update user's password in the database
  const [updateResult] = await db.execute(
    'UPDATE users SET password = ? WHERE id = ?',
    [hashedPassword, id]
  );

  if (updateResult.affectedRows === 0) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Return the new (unhashed) password to the superadmin
  res.json({
    success: true,
    message: 'Password has been reset successfully.',
    data: {
      newPassword: newPassword,
    },
  });
}));
module.exports = router;