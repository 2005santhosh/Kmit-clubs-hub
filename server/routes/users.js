const express = require("express");
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const { protect, admin } = require("../middleware/auth");

// @desc    Get all users
// @route   GET /api/users
// @access  Admin
const getUsers = async (req, res) => {
    try {
        const users = await User.find({}).select('-password').populate('club', 'name');
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
const getUserById = async (req, res) => {
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
};

// @desc    Find user by name
// @route   GET /api/users/findByName
// @access  Private
const findUserByName = async (req, res) => {
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
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin or Club Leader)
const updateUser = async (req, res) => {
    try {
        // Check if the id is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid user ID format' });
        }
        
        const { username, name, role, status } = req.body;
        
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Authorization check
        if (req.user.role !== 'admin') {
            // If not admin, must be a club leader
            if (req.user.role !== 'clubLeader') {
                return res.status(403).json({ message: "Not authorized to update users" });
            }
            
            // Check if user is in the same club as the current user
            if (!user.club || !req.user.club || user.club.toString() !== req.user.club.toString()) {
                return res.status(403).json({ message: "Not authorized to update users from other clubs" });
            }
            
            // Prevent club leaders from assigning admin roles
            if (role === 'admin') {
                return res.status(403).json({ message: "Club leaders cannot assign admin roles" });
            }
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
        if (role) user.role = role;
        if (status) user.status = status;
        
        const updatedUser = await user.save();
        
        res.json({
            _id: updatedUser._id,
            username: updatedUser.username,
            role: updatedUser.role,
            name: updatedUser.name,
            status: updatedUser.status,
            club: updatedUser.club
        });
    } catch (error) {
        console.error(error);
        
        // Handle duplicate username error
        if (error.code === 11000 && error.keyPattern && error.keyPattern.username) {
            return res.status(400).json({ message: "Username already taken" });
        }
        
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Admin
const deleteUser = async (req, res) => {
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
};

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
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
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
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
};

// @desc    Update notification settings
// @route   PUT /api/users/notification-settings
// @access  Private
const updateNotificationSettings = async (req, res) => {
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
};

// @desc    Change password
// @route   PUT /api/users/change-password
// @access  Private
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.user._id);

        // Check if current password matches
        const isMatch = await user.matchPassword(currentPassword);

        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Create a faculty (admin only)
// @route   POST /api/users/faculty
// @access  Admin
const createFaculty = async (req, res) => {
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
};

// @desc    Create a club leader (faculty only)
// @route   POST /api/users/club-leader
// @access  Faculty
const createClubLeader = async (req, res) => {
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
};

// @desc    Create a student (club leader only)
// @route   POST /api/users/student
// @access  Club Leader
const createStudent = async (req, res) => {
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
};

// @desc    Get faculty members
// @route   GET /api/users/faculty
// @access  Admin
const getFaculty = async (req, res) => {
    try {
        const faculty = await User.find({ role: 'faculty' }).select('-password').populate('club', 'name');
        res.json(faculty);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get club leader users
// @route   GET /api/users/club-leaders
// @access  Admin
const getClubLeaderUsers = async (req, res) => {
    try {
        const leaders = await User.find({ role: 'clubLeader' }).select('-password').populate('club', 'name');
        res.json(leaders);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get student users
// @route   GET /api/users/students
// @access  Admin
const getStudentUsers = async (req, res) => {
    try {
        const students = await User.find({ role: 'student' }).select('-password').populate('club', 'name');
        res.json(students);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Search for faculty members by name (for dropdown)
// @route   GET /api/users/search
// @access  Private
const searchFaculty = async (req, res) => {
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
};

// @desc    Fix faculty assignments for existing clubs
// @route   POST /api/users/fix-faculty-assignments
// @access  Admin
const fixFacultyAssignments = async (req, res) => {
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
};

// @desc    Get users by role
// @route   GET /api/users/role/:role
// @access  Private
const getUsersByRole = async (req, res) => {
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
};

// @desc    Create a user (admin only)
// @route   POST /api/users
// @access  Admin
const createUser = async (req, res) => {
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
};

// Route definitions
router.get("/", protect, admin, getUsers);
router.get("/faculty", protect, admin, getFaculty);
router.get("/club-leaders", protect, admin, getClubLeaderUsers);
router.get("/students", protect, admin, getStudentUsers);
router.get("/profile", protect, getUserProfile);
router.get("/findByName", protect, findUserByName);
router.get("/search", protect, searchFaculty);
router.get("/role/:role", protect, getUsersByRole);

// PUT routes - specific paths BEFORE /:id
router.put("/profile", protect, updateUserProfile);
router.put("/notification-settings", protect, updateNotificationSettings);
router.put("/change-password", protect, changePassword);

// Parameterized routes come AFTER specific routes
router.get("/:id", protect, getUserById);
router.post("/", protect, admin, createUser);
router.post("/faculty", protect, admin, createFaculty);
router.post("/club-leader", protect, createClubLeader);
router.post("/student", protect, createStudent);
router.post("/fix-faculty-assignments", protect, admin, fixFacultyAssignments);

// Main update route for profile settings (used by settings page)
router.put("/:id", protect, updateUser);  // Fixed: Use local updateUser function

// Admin update route
router.put("/:id/admin", protect, admin, updateUser);  // Fixed: Use local updateUser function

// Password change route (used by settings page)
router.put("/:id/password", protect, changePassword);  // Fixed: Use local changePassword function

router.delete("/:id", protect, admin, deleteUser);

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

module.exports = router;