const express = require('express');
const { getConnection } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken, requireAdmin, requireGroupMember } = require('../middleware/auth');
const { 
  validateGroupCreation, 
  validateGroupUpdate, 
  validateAddGroupMember,
  validateIdParam,
  validateGroupIdParam,
  validatePagination 
} = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// @desc    Create a new group
// @route   POST /api/groups
// @access  Private (Admin only)
router.post('/', validateGroupCreation, asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const db = getConnection();

  // Check if group name already exists for this admin
  const [existingGroups] = await db.execute(
    'SELECT id FROM `groups` WHERE name = ? AND admin_id = ? AND is_active = true',
    [name, req.user.id]
  );

  if (existingGroups.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'A group with this name already exists',
    });
  }

  // Create group
  const [result] = await db.execute(
    'INSERT INTO `groups` (name, description, admin_id) VALUES (?, ?, ?)',
    [name, description, req.user.id]
  );

  // Add admin as a group member
  await db.execute(
    'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
    [result.insertId, req.user.id, 'admin']
  );

  // Get created group with member count
  const [groups] = await db.execute(`
    SELECT g.*, COUNT(gm.user_id) as member_count
    FROM \`groups\` g
    LEFT JOIN group_members gm ON g.id = gm.group_id
    WHERE g.id = ?
    GROUP BY g.id
  `, [result.insertId]);

  res.status(201).json({
    success: true,
    message: 'Group created successfully',
    data: {
      group: groups[0],
    },
  });
}));

// @desc    Get all groups for the user
// @route   GET /api/groups
// @access  Private
router.get('/', validatePagination, asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search = '' } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;
    const db = getConnection();
    const { id: userId, user_type } = req.user;
    const isSuperAdmin = user_type === 'superadmin';

    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
        return res.status(400).json({
            success: false,
            message: 'Invalid page or limit parameters',
        });
    }

    let allGroups = [];

    const baseQuery = `
        SELECT g.*,
               (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
               IFNULL(CONCAT(u.first_name, ' ', u.last_name), 'N/A') as created_by_name
        FROM \`groups\` g
        LEFT JOIN users u ON g.admin_id = u.id
        WHERE g.is_active = true
    `;

    if (isSuperAdmin) {
        const [groups] = await db.execute(baseQuery);
        allGroups = groups;
    } else {
        // Get groups where user is admin
        const adminGroupsQuery = `${baseQuery} AND g.admin_id = ?`;
        const [adminGroups] = await db.execute(adminGroupsQuery, [userId]);

        // Get groups where user is a member
        const memberGroupsQuery = `
            ${baseQuery} AND g.id IN (
                SELECT group_id FROM group_members WHERE user_id = ?
            )
        `;
        const [memberGroups] = await db.execute(memberGroupsQuery, [userId]);

        // Combine and deduplicate
        const groupMap = new Map();
        [...adminGroups, ...memberGroups].forEach(group => {
            groupMap.set(group.id, group);
        });
        allGroups = Array.from(groupMap.values());
    }

    // Apply search filter in-memory
    const searchTerm = search.trim().toLowerCase();
    let filteredGroups = allGroups;
    if (searchTerm) {
        filteredGroups = allGroups.filter(group =>
            group.name.toLowerCase().includes(searchTerm) ||
            (group.description && group.description.toLowerCase().includes(searchTerm))
        );
    }
    
    // Apply sorting
    filteredGroups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Apply pagination in-memory
    const total = filteredGroups.length;
    const totalPages = Math.ceil(total / limitNum);
    const paginatedGroups = filteredGroups.slice(offset, offset + limitNum);

    res.json({
        success: true,
        data: {
            groups: paginatedGroups,
            pagination: {
                current_page: pageNum,
                total_pages: totalPages,
                total_items: total,
                items_per_page: limitNum,
            },
        },
    });
}));

// @desc    Get group by ID
// @route   GET /api/groups/:id
// @access  Private (Group members only)
router.get('/:id', validateIdParam, requireGroupMember, asyncHandler(async (req, res) => {
  const groupId = req.params.id;
  const db = getConnection();

  // Get group details
  const [groups] = await db.execute(`
    SELECT g.*, CONCAT(u.first_name, ' ', u.last_name) as admin_name
    FROM \`groups\` g
    LEFT JOIN users u ON g.admin_id = u.id
    WHERE g.id = ? AND g.is_active = true
  `, [groupId]);

  if (groups.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Group not found',
    });
  }

  // Get group members
  const [members] = await db.execute(`
    SELECT gm.role, gm.joined_at, u.id, u.email, u.first_name, u.last_name, u.user_type
    FROM group_members gm
    JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = ? AND u.is_active = true
    ORDER BY gm.role DESC, u.first_name, u.last_name
  `, [groupId]);

  // Get group task statistics
  const [taskStats] = await db.execute(`
    SELECT 
      COUNT(*) as total_tasks,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tasks,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
      SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_tasks
    FROM tasks 
    WHERE group_id = ? AND is_active = true
  `, [groupId]);

  res.json({
    success: true,
    data: {
      group: {
        ...groups[0],
        members,
        task_statistics: taskStats[0],
        user_role: req.userRole,
        is_admin: req.isGroupAdmin,
      },
    },
  });
}));

// @desc    Update group
// @route   PUT /api/groups/:id
// @access  Private (Group admin only)
router.put('/:id', validateIdParam, validateGroupUpdate, asyncHandler(async (req, res) => {
  const groupId = req.params.id;
  const { name, description } = req.body;
  const db = getConnection();

  // Check if user is group admin
  const [groups] = await db.execute(
    'SELECT admin_id FROM `groups` WHERE id = ? AND is_active = true',
    [groupId]
  );

  if (groups.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Group not found',
    });
  }

  if (groups[0].admin_id !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Only group admin can update group details',
    });
  }

  // Build update query dynamically
  const updateFields = [];
  const updateValues = [];

  if (name !== undefined) {
    // Check if new name conflicts with existing groups
    const [existingGroups] = await db.execute(
      'SELECT id FROM `groups` WHERE name = ? AND admin_id = ? AND id != ? AND is_active = true',
      [name, req.user.id, groupId]
    );

    if (existingGroups.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A group with this name already exists',
      });
    }

    updateFields.push('name = ?');
    updateValues.push(name);
  }

  if (description !== undefined) {
    updateFields.push('description = ?');
    updateValues.push(description);
  }

  if (updateFields.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No fields to update',
    });
  }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  updateValues.push(groupId);

  await db.execute(
    `UPDATE \`groups\` SET ${updateFields.join(', ')} WHERE id = ?`,
    updateValues
  );

  // Get updated group
  const [updatedGroups] = await db.execute(`
    SELECT g.*, COUNT(gm.user_id) as member_count
    FROM \`groups\` g
    LEFT JOIN group_members gm ON g.id = gm.group_id
    WHERE g.id = ?
    GROUP BY g.id
  `, [groupId]);

  res.json({
    success: true,
    message: 'Group updated successfully',
    data: {
      group: updatedGroups[0],
    },
  });
}));

// @desc    Add member to group
// @route   POST /api/groups/:id/members
// @access  Private (Group admin only)
router.post('/:id/members', validateIdParam, validateAddGroupMember, asyncHandler(async (req, res) => {
  const groupId = req.params.id;
  const { email, role = 'member' } = req.body;
  const db = getConnection();

  // Check if user is group admin
  const [groups] = await db.execute(
    'SELECT admin_id FROM `groups` WHERE id = ? AND is_active = true',
    [groupId]
  );

  if (groups.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Group not found',
    });
  }

  if (groups[0].admin_id !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Only group admin can add members',
    });
  }

  // Find user by email
  const [users] = await db.execute(
    'SELECT id, first_name, last_name, email FROM users WHERE email = ? AND is_active = true',
    [email]
  );

  if (users.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'User not found with this email',
    });
  }

  const userId = users[0].id;

  // Check if user is already a member
  const [existingMembers] = await db.execute(
    'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
    [groupId, userId]
  );

  if (existingMembers.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'User is already a member of this group',
    });
  }

  // Add member to group
  await db.execute(
    'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
    [groupId, userId, role]
  );

  res.status(201).json({
    success: true,
    message: 'Member added to group successfully',
    data: {
      member: {
        ...users[0],
        role,
        joined_at: new Date(),
      },
    },
  });
}));

// @desc    Remove member from group
// @route   DELETE /api/groups/:groupId/members/:userId
// @access  Private (Group admin only)
router.delete('/:groupId/members/:userId', validateGroupIdParam, asyncHandler(async (req, res) => {
  const { groupId, userId } = req.params;
  const db = getConnection();

  // Check if user is group admin
  const [groups] = await db.execute(
    'SELECT admin_id FROM `groups` WHERE id = ? AND is_active = true',
    [groupId]
  );

  if (groups.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Group not found',
    });
  }

  if (groups[0].admin_id !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Only group admin can remove members',
    });
  }

  // Cannot remove the admin
  if (parseInt(userId) === req.user.id) {
    return res.status(400).json({
      success: false,
      message: 'Group admin cannot be removed from the group',
    });
  }

  // Check if user is a member
  const [members] = await db.execute(
    'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
    [groupId, userId]
  );

  if (members.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'User is not a member of this group',
    });
  }

  // Remove member from group
  await db.execute(
    'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
    [groupId, userId]
  );

  res.json({
    success: true,
    message: 'Member removed from group successfully',
  });
}));

// @desc    Delete group
// @route   DELETE /api/groups/:id
// @access  Private (Group admin only)
router.delete('/:id', validateIdParam, asyncHandler(async (req, res) => {
  const groupId = req.params.id;
  const db = getConnection();

  // Check if user is group admin
  const [groups] = await db.execute(
    'SELECT admin_id FROM `groups` WHERE id = ? AND is_active = true',
    [groupId]
  );

  if (groups.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Group not found',
    });
  }

  if (groups[0].admin_id !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Only group admin can delete the group',
    });
  }

  // Soft delete group (mark as inactive)
  await db.execute(
    'UPDATE `groups` SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [groupId]
  );

  // Also soft delete associated tasks
  await db.execute(
    'UPDATE tasks SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE group_id = ?',
    [groupId]
  );

  res.json({
    success: true,
    message: 'Group deleted successfully',
  });
}));

module.exports = router;