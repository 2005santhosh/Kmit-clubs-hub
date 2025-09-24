const express = require('express');
const User = require('../models/User');
const Club = require('../models/Club');
const Event = require('../models/Event');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get dashboard stats
router.get('/stats', 
  authenticateToken, 
  requireRole(['admin', 'faculty']), 
  async (req, res) => {
    try {
      const totalUsers = await User.countDocuments({ isActive: true });
      const totalClubs = await Club.countDocuments({ isActive: true });
      const totalEvents = await Event.countDocuments();
      const pendingEvents = await Event.countDocuments({ status: 'pending' });
      const upcomingEvents = await Event.countDocuments({ 
        date: { $gte: new Date() },
        status: 'approved'
      });

      // Club distribution by category
      const clubsByCategory = await Club.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      // Recent activity
      const recentEvents = await Event.find()
        .populate('clubId', 'name')
        .populate('organizer', 'name')
        .sort({ createdAt: -1 })
        .limit(5);

      res.json({
        stats: {
          totalUsers,
          totalClubs,
          totalEvents,
          pendingEvents,
          upcomingEvents
        },
        clubsByCategory,
        recentEvents
      });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ message: 'Failed to fetch dashboard stats' });
    }
  }
);

// Get all users
router.get('/users', 
  authenticateToken, 
  requireRole(['admin']), 
  async (req, res) => {
    try {
      const { role, department } = req.query;
      let query = {};

      if (role) query.role = role;
      if (department) query.department = department;

      const users = await User.find(query)
        .select('-password')
        .populate('clubs.clubId', 'name')
        .sort({ createdAt: -1 });

      res.json(users);
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  }
);

// Get pending approvals
router.get('/pending', 
  authenticateToken, 
  requireRole(['admin', 'faculty']), 
  async (req, res) => {
    try {
      // Pending events
      const pendingEvents = await Event.find({ status: 'pending' })
        .populate('clubId', 'name')
        .populate('organizer', 'name email')
        .sort({ createdAt: -1 });

      // Pending memberships
      const clubsWithPendingMembers = await Club.find({
        'members.status': 'pending'
      }).populate('members.userId', 'name email department');

      const pendingMemberships = [];
      clubsWithPendingMembers.forEach(club => {
        club.members.forEach(member => {
          if (member.status === 'pending') {
            pendingMemberships.push({
              clubId: club._id,
              clubName: club.name,
              user: member.userId,
              requestDate: member.joinedAt
            });
          }
        });
      });

      res.json({
        pendingEvents,
        pendingMemberships
      });
    } catch (error) {
      console.error('Get pending approvals error:', error);
      res.status(500).json({ message: 'Failed to fetch pending approvals' });
    }
  }
);

module.exports = router;