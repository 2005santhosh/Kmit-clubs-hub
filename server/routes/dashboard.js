const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Club = require('../models/Club');
const Event = require('../models/Event');
const { protect, authorize } = require('../middleware/auth');

// @desc    Get dashboard stats for club leader
// @route   GET /api/dashboard/stats
// @access  Private (Club Leader)
router.get('/stats', protect, authorize('clubLeader'), async (req, res) => {
  try {
    // Get user's club
    const user = await User.findById(req.user._id).populate('club');
    
    if (!user.club) {
      return res.status(404).json({ message: 'User is not associated with any club' });
    }
    
    const clubId = user.club._id;
    
    // Get total members count
    const totalMembers = await User.countDocuments({ club: clubId });
    
    // Get total events count (only approved events)
    const totalEvents = await Event.countDocuments({ 
      clubId: clubId,
      status: 'approved'
    });
    
    // Get pending approvals count (events with pending status)
    const pendingApprovals = await Event.countDocuments({ 
      clubId: clubId, 
      status: 'pending' 
    });
    
    // Calculate club rating from approved events
    const events = await Event.find({ 
      clubId: clubId, 
      status: 'approved',
      rating: { $exists: true, $ne: null } 
    });
    
    let clubRating = 0;
    if (events.length > 0) {
      const totalRating = events.reduce((sum, event) => sum + (event.rating || 0), 0);
      clubRating = (totalRating / events.length).toFixed(1);
    }
    
    res.json({
      totalMembers,
      totalEvents,
      pendingApprovals,
      clubRating
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Get recent events for club leader
// @route   GET /api/dashboard/recent-events
// @access  Private (Club Leader)
router.get('/recent-events', protect, authorize('clubLeader'), async (req, res) => {
  try {
    // Get user's club
    const user = await User.findById(req.user._id).populate('club');
    
    if (!user.club) {
      return res.status(404).json({ message: 'User is not associated with any club' });
    }
    
    const clubId = user.club._id;
    
    // Get recent approved events (limit to 5)
    const events = await Event.find({ 
      clubId,
      status: 'approved'
    })
      .sort({ date: -1 })
      .limit(5)
      .populate('organizer', 'name');
    
    res.json(events);
  } catch (error) {
    console.error('Error fetching recent events:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Get pending approvals for club leader
// @route   GET /api/dashboard/pending-approvals
// @access  Private (Club Leader)
router.get('/pending-approvals', protect, authorize('clubLeader'), async (req, res) => {
  try {
    // Get user's club
    const user = await User.findById(req.user._id).populate('club');
    
    if (!user.club) {
      return res.status(404).json({ message: 'User is not associated with any club' });
    }
    
    const clubId = user.club._id;
    
    // Get pending events (limit to 5)
    const events = await Event.find({ 
      clubId, 
      status: 'pending' 
    })
      .sort({ date: -1 })
      .limit(5)
      .populate('organizer', 'name');
    
    res.json(events);
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Get dashboard stats for faculty
// @route   GET /api/dashboard/faculty-stats
// @access  Private (Faculty)
router.get('/faculty-stats', protect, authorize('faculty'), async (req, res) => {
  try {
    // Get clubs monitored by this faculty
    const clubs = await Club.find({ faculty: req.user._id });
    const clubIds = clubs.map(club => club._id);
    
    // Get total members count across all monitored clubs
    const totalMembers = await User.countDocuments({ club: { $in: clubIds } });
    
    // Get total events count across all monitored clubs (only approved events)
    const totalEvents = await Event.countDocuments({ 
      clubId: { $in: clubIds },
      status: 'approved'
    });
    
    // Get pending approvals count across all monitored clubs
    const pendingApprovals = await Event.countDocuments({ 
      clubId: { $in: clubIds }, 
      status: 'pending' 
    });
    
    // Get number of monitored clubs
    const monitoredClubs = clubs.length;
    
    res.json({
      totalMembers,
      totalEvents,
      pendingApprovals,
      monitoredClubs
    });
  } catch (error) {
    console.error('Error fetching faculty dashboard stats:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Get dashboard stats for admin
// @route   GET /api/dashboard/admin-stats
// @access  Private (Admin)
router.get('/admin-stats', protect, authorize('admin'), async (req, res) => {
  try {
    // Get total users count
    const totalUsers = await User.countDocuments();
    
    // Get total clubs count
    const totalClubs = await Club.countDocuments();
    
    // Get total events count (only approved events)
    const totalEvents = await Event.countDocuments({ status: 'approved' });
    
    // Get pending approvals count
    const pendingApprovals = await Event.countDocuments({ status: 'pending' });
    
    // Get users by role
    const usersByRole = await User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      totalUsers,
      totalClubs,
      totalEvents,
      pendingApprovals,
      usersByRole
    });
  } catch (error) {
    console.error('Error fetching admin dashboard stats:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;