const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Club = require('../models/Club');

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', async (req, res) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'kmitclubshub');
    
    // FIXED: Enhanced populate with error handling
    let user;
    try {
      user = await User.findById(decoded.id)
        .select('systemRole role name username clubs club')  // Include both club and clubs
        .populate('club', 'name description category logo')  // Legacy single club (primary for leaders)
        .populate({
          path: 'clubs._id',  // FIXED: Properly populate the _id field inside clubs array
          select: 'name description category logo'
        });
    } catch (populateError) {
      console.error('Populate error in /me:', populateError);
      return res.status(500).json({ message: 'Failed to load user profile' });
    }
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // FIXED: If no primary club but user is clubLeader, derive from first club in clubs array
    if (user.systemRole === 'clubLeader' && (!user.club || !user.club._id) && user.clubs && user.clubs.length > 0) {
      // Assume first club in array is primary for leaders; adjust logic if needed
      user.club = user.clubs[0];
      console.warn(`Derived primary club for user ${user._id}: ${user.club?.name || 'Unknown'}`);  // Safe access
    }
    
    // Transform to ensure consistent role field (from userController pattern)
    const userObj = user.toObject();
    userObj.role = userObj.systemRole || userObj.role;
    
    // FIXED: Fully safe debug log - Uses optional chaining (?.) to prevent crashes
    const clubInfo = user.club?._id 
      ? { _id: user.club._id, name: user.club.name || 'Unnamed Club' } 
      : 'No club assigned';
    console.log('User with populated club:', clubInfo);  // Now crash-proof
    
    res.json(userObj);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Unchanged: Inclusion for password (isolated query)
    const user = await User.findOne({ username }).select('+password');
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Check if password matches
    const isMatch = await user.matchPassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // REMOVED: Status check and auto-fix - All users are now active by default
    
    // Update last login
    user.lastLogin = Date.now();
    await user.save();
    
    // Create token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || 'kmitclubshub',
      { expiresIn: process.env.JWT_EXPIRE || '30d' }
    );
    
    // FIXED: Pure inclusion projection for response user (no status), with enhanced populate
    let userWithClub;
    try {
      userWithClub = await User.findById(user._id)
        .select('systemRole role name username clubs club')  // Include both
        .populate('club', 'name description category logo')  // Legacy single club
        .populate({
          path: 'clubs._id',  // FIXED: Properly populate the _id field inside clubs array
          select: 'name description category logo'
        });
    } catch (populateError) {
      console.error('Populate error in login:', populateError);
      return res.status(500).json({ message: 'Failed to load user profile' });
    }
    
    // FIXED: If no primary club but user is clubLeader, derive from first club in clubs array
    if (userWithClub.systemRole === 'clubLeader' && (!userWithClub.club || !userWithClub.club._id) && userWithClub.clubs && userWithClub.clubs.length > 0) {
      // Assume first club in array is primary for leaders; adjust logic if needed
      userWithClub.club = userWithClub.clubs[0];
      console.warn(`Derived primary club for user ${userWithClub._id} on login: ${userWithClub.club?.name || 'Unknown'}`);  // Safe access
    }
    
    // Transform to ensure consistent role field (from userController pattern)
    const userObj = userWithClub.toObject();
    userObj.role = userObj.systemRole || userObj.role;
    
    // FIXED: Fully safe debug log on login (mirrors /me)
    const clubInfo = userWithClub.club?._id 
      ? { _id: userWithClub.club._id, name: userWithClub.club.name || 'Unnamed Club' } 
      : 'No club assigned';
    console.log('Login - User with populated club:', clubInfo);  // Now crash-proof
    
    res.json({
      success: true,
      token,
      role: userObj.systemRole,  // Top-level role
      user: userObj
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;