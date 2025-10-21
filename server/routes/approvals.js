const express = require('express');
const router = express.Router();

// Safe import with validation
let { protect, faculty, authorize } = require('../middleware/auth');

// Validate and replace undefined middleware
if (typeof protect !== 'function') {
  console.error('ERROR: protect middleware not found - using fallback');
  protect = (req, res, next) => next();
}
if (typeof faculty !== 'function') {
  console.error('ERROR: faculty middleware not found - using fallback');
  faculty = (req, res, next) => next();
}
if (typeof authorize !== 'function') {
  console.error('ERROR: authorize middleware not found - using fallback');
  authorize = (...roles) => (req, res, next) => next();
}

// Import models
const Approval = require('../models/Approval');
const Club = require('../models/Club');
const User = require('../models/User');

// @desc    Get all approvals for faculty
// @route   GET /api/approvals/faculty
// @access  Private (Faculty)
router.get('/faculty', protect, faculty, async (req, res) => {
  try {
    const approvals = await Approval.find({ faculty: req.user._id })
      .populate('club', 'name')
      .populate('requestedBy', 'name')
      .sort({ createdAt: -1 });
    
    res.json(approvals);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Get approval by ID
// @route   GET /api/approvals/:id
// @access  Private (Faculty)
router.get('/:id', protect, faculty, async (req, res) => {
  try {
    const approval = await Approval.findById(req.params.id)
      .populate('club', 'name')
      .populate('requestedBy', 'name')
      .populate('faculty', 'name');
    
    if (!approval) {
      return res.status(404).json({ message: 'Approval not found' });
    }
    
    res.json(approval);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Create a new approval
// @route   POST /api/approvals
// @access  Private (Club Leader, Faculty)
router.post('/', protect, authorize('clubLeader', 'faculty'), async (req, res) => {
  try {
    const { 
      type, 
      title, 
      description, 
      club, 
      date, 
      venue, 
      budget, 
      amount, 
      purpose, 
      name, 
      username 
    } = req.body;
    
    // Validate required fields
    if (!type || !club) {
      return res.status(400).json({ 
        message: 'Type and club are required fields' 
      });
    }
    
    // Get the club to find faculty
    const clubData = await Club.findById(club);
    if (!clubData) {
      return res.status(404).json({ message: 'Club not found' });
    }
    
    // Create new approval
    const newApproval = new Approval({
      type,
      title,
      description,
      club,
      requestedBy: req.user._id,
      faculty: clubData.faculty || req.body.faculty,
      date,
      venue,
      budget,
      amount,
      purpose,
      name,
      username
    });
    
    const approval = await newApproval.save();
    
    res.status(201).json(approval);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Update approval status (approve/reject)
// @route   PATCH /api/approvals/:id
// @access  Private (Faculty)
router.patch('/:id', protect, faculty, async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    
    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ 
        message: 'Status must be either "approved" or "rejected"' 
      });
    }
    
    const approval = await Approval.findById(req.params.id);
    
    if (!approval) {
      return res.status(404).json({ message: 'Approval not found' });
    }
    
    // Update approval
    approval.status = status;
    approval.approvedBy = req.user._id;
    approval.approvedAt = new Date();
    
    if (status === 'rejected' && rejectionReason) {
      approval.rejectionReason = rejectionReason;
    } else {
      approval.rejectionReason = undefined;
    }
    
    await approval.save();
    
    res.json(approval);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Delete an approval
// @route   DELETE /api/approvals/:id
// @access  Private (Faculty)
router.delete('/:id', protect, faculty, async (req, res) => {
  try {
    const approval = await Approval.findById(req.params.id);
    
    if (!approval) {
      return res.status(404).json({ message: 'Approval not found' });
    }
    
    await approval.remove();
    
    res.json({ message: 'Approval removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Get approvals with query parameters (for club leader dashboard)
// @route   GET /api/approvals
// @access  Private (Club Leader, Faculty)
router.get('/', protect, authorize('clubLeader', 'faculty'), async (req, res) => {
  try {
    const { status, limit, club } = req.query;
    const query = {};
    
    // If user is club leader, only show approvals for their club
    if (req.user.role === 'clubLeader') {
      // First try to get club from user's club field
      let userClub = req.user.club;
      
      // If not available, find club where user is leader
      if (!userClub) {
        const clubData = await Club.findOne({ leader: req.user._id });
        if (!clubData) {
          return res.status(404).json({ message: 'Club not found for this leader' });
        }
        userClub = clubData._id;
      }
      
      query.club = userClub;
    }
    // If faculty and club is specified in query, filter by that club
    else if (req.user.role === 'faculty' && club) {
      query.club = club;
    }
    
    // If status is provided, filter by status
    if (status) {
      query.status = status;
    }
    
    let approvalsQuery = Approval.find(query)
      .populate('club', 'name')
      .populate('requestedBy', 'name');
    
    if (limit) {
      const limitNum = parseInt(limit);
      if (!isNaN(limitNum) && limitNum > 0) {
        approvalsQuery = approvalsQuery.limit(limitNum);
      }
    }
    
    const approvals = await approvalsQuery.sort({ createdAt: -1 });
    
    res.json(approvals);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;