const express = require('express');
const router = express.Router();
const { 
  getUsers, 
  createFaculty, 
  createClubLeader, 
  createStudent,
  getFaculty
} = require('../controllers/userController');
const { protect, admin } = require('../middleware/auth');
const { canCreateRole } = require('../middleware/roleAccess');
const User = require('../models/User');

// Admin routes
router.get('/', protect, admin, getUsers);
router.get('/faculty', protect, admin, getFaculty);
router.post('/faculty', protect, admin, createFaculty);

// Faculty routes
router.post('/club-leader', protect, canCreateRole('clubLeader'), createClubLeader);

// Club leader routes
router.post('/student', protect, canCreateRole('student'), createStudent);

// Get user profile
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, bio } = req.body;
    
    // Find user and update
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { name, bio } },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change password
router.post('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Find user
    const user = await User.findById(req.user._id);
    
    // Check if current password matches
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Find user by name (for faculty coordinator in club creation)
router.get('/findByName', protect, async (req, res) => {
  try {
    const { name, role } = req.query;
    
    if (!name) {
      return res.status(400).json({ message: 'Name parameter is required' });
    }
    
    const query = { name: { $regex: name, $options: 'i' } };
    
    if (role) {
      query.role = role;
    }
    
    const user = await User.findOne(query).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user by ID
router.get('/:id', protect, admin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user by ID
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const { username, name, role, department, bio, isActive } = req.body;
    
    // Find user and update
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { username, name, role, department, bio, isActive },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;