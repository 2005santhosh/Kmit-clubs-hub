const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// @desc    Get user's clubs
// @route   GET /api/users/my-clubs
// @access  Private
router.get('/my-clubs', protect, async (req, res) => {
    try {
        // Find the user and populate their clubs
        const user = await User.findById(req.user._id).populate('clubs');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Return user's clubs
        return res.json(user.clubs || []);
    } catch (error) {
        console.error('Error fetching user clubs:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Get user's points
// @route   GET /api/users/points
// @access  Private
router.get('/points', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const nextLevelPoints = 200; // Points needed for next level
    const progressPercentage = Math.min(100, (user.points / nextLevelPoints) * 100);
    
    res.json({
      totalPoints: user.points,
      nextLevelPoints,
      progressPercentage
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Add points to user (for testing)
// @route   POST /api/users/:id/add-points
// @access  Private
router.post('/:id/add-points', protect, async (req, res) => {
  try {
    const { points } = req.body;
    
    if (!points || points <= 0) {
      return res.status(400).json({ message: 'Points must be a positive number' });
    }
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Add points
    user.points += points;
    await user.save();
    
    // Emit socket event for real-time update
    const reqApp = req.app;
    if (reqApp.get('io')) {
      reqApp.get('io').to(user._id.toString()).emit('points-updated', {
        userId: user._id,
        points: user.points,
        pointsEarned: points,
        progressPercentage: Math.min(100, (user.points / 200) * 100)
      });
    }
    
    res.json({ 
      message: `Added ${points} points to user`,
      totalPoints: user.points
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Get user's rewards
// @route   GET /api/users/rewards
// @access  Private
router.get('/rewards', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({
        path: 'rewards',
        model: 'Reward',
        select: 'name icon description points category'
      })
      .select('rewards')
      .lean();

    res.json(user.rewards || []);
  } catch (error) {
    console.error('Error fetching user rewards:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Get user's registered events
// @route   GET /api/users/registered-events
// @access  Private
router.get('/registered-events', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const Event = require('../models/Event');

    const events = await Event.find({
      'registeredParticipants.userId': userId,
      status: { $ne: 'cancelled' }
    })
    .populate('clubId', 'name')
    .sort({ date: 1 })
    .limit(50);

    res.json(events);
  } catch (error) {
    console.error('Error fetching registered events:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Get all users
// @route   GET /api/users
// @access  Admin
router.get("/", protect, async (req, res) => {
    try {
        const users = await User.find({}).select('-password').populate('club', 'name');
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Get faculty members
// @route   GET /api/users/faculty
// @access  Admin
router.get("/faculty", protect, async (req, res) => {
    try {
        const faculty = await User.find({ role: 'faculty' }).select('-password').populate('club', 'name');
        res.json(faculty);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Get club leader users
// @route   GET /api/users/club-leaders
// @access  Admin
router.get("/club-leaders", protect, async (req, res) => {
    try {
        const leaders = await User.find({ role: 'clubLeader' }).select('-password').populate('club', 'name');
        res.json(leaders);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Get student users
// @route   GET /api/users/students
// @access  Admin
router.get("/students", protect, async (req, res) => {
    try {
        const students = await User.find({ role: 'student' }).select('-password').populate('club', 'name');
        res.json(students);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
router.get("/profile", protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
          .select('-password')
          .populate('club', 'name')
          .populate({
            path: 'clubs._id',
            model: 'Club',
            select: 'name'
          });
        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Find user by name
// @route   GET /api/users/findByName
// @access  Private
router.get("/findByName", protect, async (req, res) => {
    try {
        const { name, role } = req.query;
        
        if (!name) {
            return res.status(400).json({ message: 'Name is required' });
        }
        
        let query = { name: { $regex: name, $options: 'i' } };
        
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
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Search for faculty members by name (for dropdown)
// @route   GET /api/users/search
// @access  Private
router.get("/search", protect, async (req, res) => {
    try {
        const { term } = req.query;
        
        if (!term || term.length < 2) {
            return res.status(400).json({ message: 'Search term must be at least 2 characters' });
        }
        
        // Search for faculty members matching the term
        const users = await User.find({
            role: 'faculty',
            $or: [
                { name: { $regex: term, $options: 'i' } },
                { username: { $regex: term, $options: 'i' } }
            ]
        }).select('name username department').limit(10);
        
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Get users by role
// @route   GET /api/users/role/:role
// @access  Private
router.get("/role/:role", protect, async (req, res) => {
    try {
        const { role } = req.params;
        
        // Validate role value
        const validRoles = ['student', 'clubLeader', 'faculty', 'admin'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ message: 'Invalid role value' });
        }
        
        const users = await User.find({ role }).populate('club', 'name');
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
router.get("/:id", protect, async (req, res) => {
    try {
        // Check if the id is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid user ID format' });
        }
        
        const user = await User.findById(req.params.id).select('-password').populate('club', 'name');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// PUT routes - specific paths BEFORE /:id
// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
router.put("/profile", protect, async (req, res) => {
    try {
        const { name, username, department, bio } = req.body;

        const user = await User.findById(req.user._id);

        if (name) user.name = name;
        if (username) {
            // Check if username is already taken by another user
            if (username !== user.username) {
                const existingUser = await User.findOne({ username });
                if (existingUser) {
                    return res.status(400).json({ message: 'Username already taken' });
                }
            }
            user.username = username;
        }
        if (department) user.department = department;
        if (bio) user.bio = bio;

        const updatedUser = await user.save();

        // Remove password from response
        const userResponse = updatedUser.toObject();
        delete userResponse.password;

        res.json(userResponse);
    } catch (error) {
        console.error(error);
        
        // Handle duplicate username error
        if (error.code === 11000 && error.keyPattern && error.keyPattern.username) {
            return res.status(400).json({ message: "Username already exists" });
        }
        
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Update notification settings
// @route   PUT /api/users/notification-settings
// @access  Private
router.put("/notification-settings", protect, async (req, res) => {
    try {
        const { notificationSettings } = req.body;

        const user = await User.findById(req.user._id);
        user.notificationSettings = notificationSettings;

        const updatedUser = await user.save();

        // Remove password from response
        const userResponse = updatedUser.toObject();
        delete userResponse.password;

        res.json(userResponse);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Change password
// @route   PUT /api/users/change-password
// @access  Private
router.put("/change-password", protect, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.user._id);

        // Check if current password matches
        const isMatch = await user.matchPassword(currentPassword);

        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        // Validate new password
        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters long' });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Assign a club to a user
// @route   POST /api/users/assign-club
// @access  Admin
router.post("/assign-club", protect, async (req, res) => {
    try {
        const { userId, clubId, role } = req.body;
        
        if (!userId || !clubId) {
            return res.status(400).json({ message: 'User ID and Club ID are required' });
        }
        
        // Check if the id is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(clubId)) {
            return res.status(400).json({ message: 'Invalid ID format' });
        }
        
        // Find the user
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Update user's club and clubRole
        user.club = clubId;
        user.clubRole = role || 'member';
        
        await user.save();
        
        // Populate club info for response
        const populatedUser = await User.findById(userId)
            .select('-password')
            .populate('club', 'name');
        
        res.json({ 
            message: 'Club assigned successfully',
            user: populatedUser
        });
    } catch (error) {
        console.error('Error assigning club:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Remove club assignment from a user
// @route   DELETE /api/users/remove-club
// @access  Admin
router.delete("/remove-club", protect, async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }
        
        // Check if the id is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid user ID format' });
        }
        
        // Find the user
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Remove user's club assignment
        user.club = null;
        user.clubRole = 'member';
        
        await user.save();
        
        res.json({ 
            message: 'Club assignment removed successfully',
            user: {
                _id: user._id,
                name: user.name,
                club: null,
                clubRole: 'member'
            }
        });
    } catch (error) {
        console.error('Error removing club assignment:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Parameterized routes come AFTER specific routes
// @desc    Create a user (admin only)
// @route   POST /api/users
// @access  Admin
router.post("/", protect, async (req, res) => {
    const { username, password, name, role, department, bio } = req.body

    try {
        // Check if user already exists
        const userExists = await User.findOne({ username })

        if (userExists) {
            return res.status(400).json({ message: "User already exists" })
        }

        // Create user
        const user = await User.create({
            username,
            password: password || 'Kmit123$', // Default password if not provided
            name,
            role,
            department,
            bio,
        })

        res.status(201).json({
            _id: user._id,
            username: user.username,
            name: user.name,
            role: user.role,
            department: user.department,
            bio: user.bio,
        })
    } catch (error) {
        console.error("Error creating user:", error)
        res.status(500).json({ message: "Server Error" })
    }
});

// @desc    Create a faculty (admin only)
// @route   POST /api/users/faculty
// @access  Admin
router.post("/faculty", protect, async (req, res) => {
    const { username, name, department } = req.body;
    
    try {
        // Check if user exists
        const userExists = await User.findOne({ username });
        
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }
        
        // Create faculty with default password
        const user = await User.create({
            username,
            password: 'Kmit123$', // Default password
            role: 'faculty',
            name,
            department,
            createdBy: req.user._id
        });
        
        res.status(201).json({
            _id: user._id,
            username: user.username,
            role: user.role,
            name: user.name,
            department: user.department
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Create a club leader (faculty only)
// @route   POST /api/users/club-leader
// @access  Faculty
router.post("/club-leader", protect, async (req, res) => {
    const { username, name } = req.body;
    const club = req.club; // From middleware
    
    try {
        // Check if user exists
        const userExists = await User.findOne({ username });
        
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }
        
        // Create club leader with default password
        const user = await User.create({
            username,
            password: 'Kmit123$', // Default password
            role: 'clubLeader',
            name,
            club: club._id,
            createdBy: req.user._id
        });
        
        res.status(201).json({
            _id: user._id,
            username: user.username,
            role: user.role,
            name: user.name,
            club: user.club._id
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Create a student (club leader only)
// @route   POST /api/users/student
// @access  Club Leader
router.post("/student", protect, async (req, res) => {
    const { username, name } = req.body;
    const club = req.club; // From middleware
    
    try {
        // Check if user exists
        const userExists = await User.findOne({ username });
        
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }
        
        // Create student with default password
        const user = await User.create({
            username,
            password: 'Kmit123$', // Default password
            role: 'student',
            name,
            club: club._id,
            createdBy: req.user._id
        });
        
        res.status(201).json({
            _id: user._id,
            username: user.username,
            role: user.role,
            name: user.name,
            club: user.club._id
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Fix faculty assignments for existing clubs
// @route   POST /api/users/fix-faculty-assignments
// @access  Admin
router.post("/fix-faculty-assignments", protect, async (req, res) => {
    try {
        const Club = require('../models/Club');
        
        // Find all clubs with faculty coordinators
        const clubs = await Club.find({ facultyCoordinator: { $ne: null } });
        
        let fixedCount = 0;
        
        for (const club of clubs) {
            // Update faculty member with club reference
            const result = await User.updateOne(
                { _id: club.facultyCoordinator, club: { $ne: club._id } },
                { $set: { club: club._id } }
            );
            
            if (result.modifiedCount > 0) {
                fixedCount++;
                console.log(`Fixed faculty assignment for club: ${club.name}`);
            }
        }
        
        res.json({ 
            message: 'Faculty assignments fixed successfully', 
            fixedCount 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Update user profile (for settings page)
// @route   PUT /api/users/:id
// @access  Private
router.put("/:id", protect, async (req, res) => {
    try {
        const { name, bio, department, club, clubRole } = req.body;
        
        // Find user
        let user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Check if user is updating their own profile or is an admin
        if (user._id.toString() !== req.user._id.toString() && req.user.systemRole !== 'admin') {
            return res.status(403).json({ message: 'Not authorized to update this user' });
        }
        
        // Update fields
        user.name = name || user.name;
        user.bio = bio || user.bio;
        user.department = department || user.department;
        
        // Update club assignment if provided
        if (club !== undefined) {
            user.club = club;
        }
        
        // Update club role if provided
        if (clubRole !== undefined) {
            user.clubRole = clubRole;
        }
        
        await user.save();
        
        // Get updated user with populated club info
        const updatedUser = await User.findById(user._id)
            .select('-password')
            .populate('club', 'name');
        
        res.json(updatedUser);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Update user (admin functions) - NEW ROUTE
// @route   PUT /api/users/:id/admin
// @access  Private (Admin)
router.put("/:id/admin", protect, async (req, res) => {
    try {
        // Check if the id is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid user ID format' });
        }
        
        const { username, name, clubRole, status, clubs, club, role } = req.body;
        
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Authorization check
        const userSystemRole = user.systemRole || user.role;
        const reqUserSystemRole = req.user.systemRole || req.user.role;
        
        if (reqUserSystemRole !== 'admin') {
            return res.status(403).json({ message: "Not authorized to update users" });
        }
        
        // Check if username is already taken by another user
        if (username && username !== user.username) {
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                return res.status(400).json({ message: 'Username already taken' });
            }
        }
        
        // Update fields
        if (username) user.username = username;
        if (name) user.name = name;
        if (clubRole) user.clubRole = clubRole;
        if (status) user.status = status;
        
        // Update system role if provided
        if (role) {
            user.systemRole = role;
            user.role = role; // For backward compatibility
        }
        
        // Handle club assignment based on role
        if (role === 'faculty' || role === 'clubLeader') {
            // For faculty and club leaders, update the clubs array
            if (clubs && clubs.length > 0) {
                // Clear existing clubs first
                user.clubs = [];
                
                // Add each club with proper structure
                clubs.forEach(clubData => {
                    user.clubs.push({
                        _id: clubData._id,
                        role: clubData.role || 'member',
                        joinDate: clubData.joinDate || new Date()
                    });
                });
                
                // Clear the club field since they use clubs array
                user.club = null;
            } else {
                // If no clubs provided, clear existing clubs
                user.clubs = [];
                user.club = null;
            }
        } else if (role === 'student') {
            // For students, update the club field
            if (club) {
                user.club = club;
                // Clear the clubs array since they use club field
                user.clubs = [];
            } else {
                // If no club provided, clear existing club
                user.club = null;
                user.clubs = [];
            }
        }
        
        const updatedUser = await user.save();
        
        // Populate the club information for the response
        await updatedUser.populate('club', 'name');
        await updatedUser.populate('clubs._id', 'name');
        
        // Transform user to ensure consistent role field
        const userObj = updatedUser.toObject();
        userObj.role = userObj.systemRole || userObj.role;
        
        res.json(userObj);
    } catch (error) {
        console.error('Error updating user:', error);
        
        // Handle duplicate username error
        if (error.code === 11000 && error.keyPattern && error.keyPattern.username) {
            return res.status(400).json({ message: "Username already exists" });
        }
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Change password (for settings page)
// @route   PUT /api/users/:id/password
// @access  Private
router.put("/:id/password", protect, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Please provide current and new password' });
        }
        
        // Find user
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Check if user is updating their own password
        if (user._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to change this user\'s password' });
        }
        
        // Check current password
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }
        
        // Validate new password
        if (newPassword.length < 8) {
            return res.status(400).json({ message: 'New password must be at least 8 characters long' });
        }
        
        // Update password
        user.password = newPassword;
        await user.save();
        
        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Admin
router.delete("/:id", protect, async (req, res) => {
    try {
        // Check if the id is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid user ID format' });
        }
        
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        await User.findByIdAndDelete(req.params.id);
        
        res.json({ message: 'User removed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;