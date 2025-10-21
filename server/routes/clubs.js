const express = require('express');
const router = express.Router();
const clubController = require('../controllers/clubController');
const { protect, admin, faculty, authorize } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
// routes/clubs.js
const Club = require('../models/Club');
const User = require('../models/User');

// @route   POST /api/clubs/:id/join
// @desc    Join a club
// @access  Private
router.post('/:id/join', protect, async (req, res) => {
  try {
    const club = await Club.findById(req.params.id);
    
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }
    
    const user = await User.findById(req.user.id);
    
    // Check if user is already a member
    const isMember = club.members.some(member => 
      member._id.toString() === req.user.id
    );
    
    if (isMember) {
      return res.status(400).json({ message: 'You are already a member of this club' });
    }
    
    // Add user to club
    club.members.push({
      _id: req.user.id,
      role: 'member',
      joinDate: Date.now()
    });
    
    await club.save();
    
    // Add club to user's clubs using the model method to ensure correct structure
    await user.addClub(club._id, 'member');
    
    // Emit socket event for real-time update
    const reqApp = req.app;
    if (reqApp.get('io')) {
      reqApp.get('io').to(user._id.toString()).emit('points-updated', {
        userId: user._id,
        points: user.points,
        pointsEarned: 10,
        progressPercentage: Math.min(100, (user.points / 200) * 100)
      });
    }
    
    res.json({ 
      message: 'Joined club successfully',
      points: user.points,
      pointsEarned: 10
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});
// ... rest of the clubs.js file remains the same
// Configure multer for club banner uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../public/uploads/clubs');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Get all clubs
router.get('/', clubController.getClubs);

// Get clubs monitored by faculty - IMPORTANT: This must come before /:id route
router.get('/faculty-monitored', protect, faculty, clubController.getFacultyMonitoredClubs);

// Get a club by ID
router.get('/:id', clubController.getClubById);

// Get a club by ID with full details
router.get('/:id/full', protect, admin, clubController.getClubByIdFull);

// Get club members
router.get('/:id/members', protect, clubController.getClubMembers);

// Debug endpoint for club data
router.get('/:id/debug', protect, clubController.debugClubData);

// Add member to club
router.post('/:id/members', protect, authorize('clubLeader'), clubController.addClubMember);

// Remove member from club
router.delete('/:id/members/:memberId', protect, authorize('clubLeader'), clubController.removeClubMember);

// Create a club
router.post('/', protect, admin, clubController.createClub);

// Update a club
router.put('/:id', protect, admin, clubController.updateClub);

// Delete a club
router.delete('/:id', protect, admin, clubController.deleteClub);

// Assign faculty to a club
router.put('/:id/assign-faculty', protect, admin, clubController.assignFaculty);

// Assign leader to a club
router.put('/:id/assign-leader', protect, admin, clubController.assignLeader);

// Remove faculty from a club
router.put('/:id/remove-faculty', protect, admin, clubController.removeFaculty);

// Remove leader from a club
router.put('/:id/remove-leader', protect, admin, clubController.removeLeader);

// Clean up invalid member references
router.post('/cleanup-members', protect, admin, clubController.cleanupInvalidMembers);

// Update a club member
router.put('/:id/members/:memberId', protect, authorize('clubLeader'), clubController.updateClubMember);

// Update club settings (for club leaders)
router.put('/:id/settings', protect, authorize('clubLeader'), upload.single('bannerImage'), clubController.updateClubSettings);

module.exports = router;