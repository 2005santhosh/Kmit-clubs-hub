const mongoose = require('mongoose');
const User = require('../models/User');

// @desc    Get all users
// @route   GET /api/users
// @access  Admin
const getUsers = async (req, res) => {
    try {
        const users = await User.find({})
            .select('-password')
            .populate('club', 'name')
            .populate({
                path: 'clubs._id',
                model: 'Club',
                select: 'name'
            });
        
        // Transform users to ensure consistent role field
        const transformedUsers = users.map(user => {
            const userObj = user.toObject();
            // Use systemRole if available, otherwise fall back to role
            userObj.role = userObj.systemRole || userObj.role;
            return userObj;
        });
        
        res.json(transformedUsers);
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
        
        const user = await User.findById(req.params.id)
            .select('-password')
            .populate('club', 'name')
            .populate({
                path: 'clubs._id',
                model: 'Club',
                select: 'name'
            });
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Transform user to ensure consistent role field
        const userObj = user.toObject();
        userObj.role = userObj.systemRole || userObj.role;
        
        res.json(userObj);
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
            // Check both systemRole and role for compatibility
            query.$or = [
                { systemRole: role },
                { role: role }
            ];
        }
        
        const user = await User.findOne(query).select('-password').populate('club', 'name').populate('clubs._id', 'name');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Transform user to ensure consistent role field
        const userObj = user.toObject();
        userObj.role = userObj.systemRole || userObj.role;
        
        res.json(userObj);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Update user profile (for settings page)
// @route   PUT /api/users/:id
// @access  Private
const updateUserProfile = async (req, res) => {
    try {
        // Check if the id is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid user ID format' });
        }
        
        const { name, bio } = req.body;
        
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Check if user is updating their own profile
        if (req.user._id.toString() !== req.params.id && req.user.systemRole !== 'admin') {
            return res.status(401).json({ message: 'Not authorized' });
        }
        
        // Update fields
        if (name) user.name = name;
        if (bio !== undefined) user.bio = bio;
        
        const updatedUser = await user.save();
        
        // Populate club information for the response
        await updatedUser.populate('club', 'name');
        await updatedUser.populate('clubs._id', 'name');
        
        res.json(updatedUser);
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Update user (admin functions)
// @route   PUT /api/users/:id/admin
// @access  Private (Admin or Club Leader)
const updateUserAdmin = async (req, res) => {
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
            if (reqUserSystemRole !== 'clubLeader') {
                return res.status(403).json({ message: "Not authorized to update users" });
            }
            
            // Check if user is in the same club as the current user
            if (!user.club || !req.user.club || user.club.toString() !== req.user.club.toString()) {
                return res.status(403).json({ message: "Not authorized to update users from other clubs" });
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
        const user = await User.findById(req.user._id).select('-password').populate('club', 'name').populate('clubs._id', 'name');
        
        // Transform user to ensure consistent role field
        const userObj = user.toObject();
        userObj.role = userObj.systemRole || userObj.role;
        
        res.json(userObj);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Update user profile (legacy endpoint)
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfileLegacy = async (req, res) => {
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
        
        // Transform user to ensure consistent role field
        userResponse.role = userResponse.systemRole || userResponse.role;

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
        
        // Transform user to ensure consistent role field
        userResponse.role = userResponse.systemRole || userResponse.role;

        res.json(userResponse);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Change password
// @route   PUT /api/users/:id/password
// @access  Private
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.params.id);

        // Check if user is changing their own password
        if (req.user._id.toString() !== req.params.id) {
            return res.status(401).json({ message: 'Not authorized' });
        }

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

// @desc    Change password (legacy endpoint)
// @route   PUT /api/users/change-password
// @access  Private
const changePasswordLegacy = async (req, res) => {
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
  const { username, name, department, clubId } = req.body; // Optional clubId
  
  try {
    console.log('Creating faculty:', { username, name, department, clubId }); // Debug log
    
    // Check if user exists
    const userExists = await User.findOne({ username });
    
    if (userExists) {
      console.log('User already exists:', username); // Debug
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Create faculty data
    const userData = {
      username,
      name,
      department,
      systemRole: 'faculty',  // Primary role field
      role: 'faculty',        // Backward compatibility (your queries/transforms expect this)
      status: 'active',       // Default active
      createdBy: req.user._id
    };
    
    // If clubId provided, add to clubs array with coordinator role
    if (clubId) {
      userData.clubs = [{
        _id: clubId,
        role: 'coordinator',  // Better than 'member' for faculty
        joinDate: new Date()
      }];
      console.log('Added club to faculty clubs array:', clubId); // Debug
    }
    
    // Create and save User
    const user = new User(userData);
    
    // Hash password (plain text 'Kmit123$' for default)
    user.password = 'Kmit123$';  // Set plain text—model's pre-save hook will hash it
    await user.save();  // **CRITICAL**: Persists with systemRole intact
    
    console.log('Faculty saved successfully:', user._id, 'systemRole:', user.systemRole); // Debug
    
    // Populate club if set
    if (clubId) {
      await user.populate('clubs._id', 'name');
    }
    
    // Response (transformed for consistency)
    const userObj = user.toObject();
    userObj.role = userObj.systemRole || userObj.role;  // Ensure consistent 'role'
    
    res.status(201).json({
      _id: userObj._id,
      username: userObj.username,
      role: userObj.role,
      name: userObj.name,
      department: userObj.department,
      clubs: userObj.clubs || []  // Include for frontend
    });
  } catch (error) {
    console.error('Error in createFaculty:', error); // Enhanced logging
    res.status(500).json({ message: 'Server Error', details: error.message }); // Include details for debug
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
        
        // Create club leader with default password and standardize to clubs array
        const user = await User.create({
            username,
            password: 'Kmit123$', // Default password (hashed by pre-save)
            systemRole: 'clubLeader',
            name,
            // Use clubs array for club leaders (consistent with update logic)
            clubs: [{
                _id: club._id,
                role: 'leader',
                joinDate: new Date()
            }],
            // Do NOT set club field (clear if exists, but since new, it's null)
            createdBy: req.user._id
        });
        
        // Transform user to ensure consistent role field
        const userObj = user.toObject();
        userObj.role = userObj.systemRole || userObj.role;
        
        // Populate for response (optional, since frontend refetches)
        await user.populate('clubs._id', 'name');
        const populatedUser = user.toObject();
        populatedUser.role = userObj.role;
        
        res.status(201).json({
            _id: populatedUser._id,
            username: populatedUser.username,
            role: populatedUser.role,
            name: populatedUser.name,
            club: populatedUser.clubs[0]?._id // Use first club ID for backward compat
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
            systemRole: 'student',
            name,
            club: club._id,
            createdBy: req.user._id
        });
        
        // Transform user to ensure consistent role field
        const userObj = user.toObject();
        userObj.role = userObj.systemRole || userObj.role;
        
        res.status(201).json({
            _id: userObj._id,
            username: userObj.username,
            role: userObj.role,
            name: userObj.name,
            club: userObj.club._id
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
        // Check both systemRole and role for compatibility
        const faculty = await User.find({ 
            $or: [
                { systemRole: 'faculty' },
                { role: 'faculty' }
            ]
        }).select('-password').populate('club', 'name').populate('clubs._id', 'name');
        
        // Transform users to ensure consistent role field
        const transformedUsers = faculty.map(user => {
            const userObj = user.toObject();
            userObj.role = userObj.systemRole || userObj.role;
            return userObj;
        });
        
        res.json(transformedUsers);
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
        // Check both systemRole and role for compatibility
        const leaders = await User.find({ 
            $or: [
                { systemRole: 'clubLeader' },
                { role: 'clubLeader' }
            ]
        }).select('-password').populate('club', 'name').populate('clubs._id', 'name');
        
        // Transform users to ensure consistent role field
        const transformedUsers = leaders.map(user => {
            const userObj = user.toObject();
            userObj.role = userObj.systemRole || userObj.role;
            return userObj;
        });
        
        res.json(transformedUsers);
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
        // Check both systemRole and role for compatibility
        const students = await User.find({ 
            $or: [
                { systemRole: 'student' },
                { role: 'student' }
            ]
        }).select('-password').populate('club', 'name').populate('clubs._id', 'name');
        
        // Transform users to ensure consistent role field
        const transformedUsers = students.map(user => {
            const userObj = user.toObject();
            userObj.role = userObj.systemRole || userObj.role;
            return userObj;
        });
        
        res.json(transformedUsers);
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
            $or: [
                { systemRole: 'faculty' },
                { role: 'faculty' }
            ],
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

// @desc    Fix faculty assignments for existing clubs (updated to use clubs array)
// @route   POST /api/users/fix-faculty-assignments
// @access  Admin
const fixFacultyAssignments = async (req, res) => {
    try {
        const Club = require('../models/Club');
        
        // Find all clubs with faculty coordinators
        const clubs = await Club.find({ facultyCoordinator: { $ne: null } });
        
        let fixedCount = 0;
        
        for (const club of clubs) {
            const facultyId = club.facultyCoordinator;
            
            // Check if already in clubs array
            const user = await User.findById(facultyId);
            const alreadyInClubs = user.clubs.some(c => c._id.toString() === club._id.toString());
            
            if (!alreadyInClubs) {
                // Add to clubs array if not present
                user.clubs.push({
                    _id: club._id,
                    role: 'member', // Or 'coordinator' if you add that enum
                    joinDate: new Date()
                });
                // Clear legacy club field if set to this club
                if (user.club && user.club.toString() === club._id.toString()) {
                    user.club = null;
                }
                await user.save();
                fixedCount++;
                console.log(`Fixed faculty assignment for club: ${club.name} (added to clubs array)`);
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
        
        // Check both systemRole and role for compatibility
        const users = await User.find({ 
            $or: [
                { systemRole: role },
                { role: role }
            ]
        }).populate('club', 'name').populate('clubs._id', 'name');
        
        // Transform users to ensure consistent role field
        const transformedUsers = users.map(user => {
            const userObj = user.toObject();
            userObj.role = userObj.systemRole || userObj.role;
            return userObj;
        });
        
        res.json(transformedUsers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Create a user (admin only)
// @route   POST /api/users
// @access  Admin
const createUser = async (req, res) => {
    const { username, password, name, systemRole, department, bio } = req.body

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
            systemRole,
            department,
            bio,
        })

        // Transform user to ensure consistent role field
        const userObj = user.toObject();
        userObj.role = userObj.systemRole || userObj.role;

        res.status(201).json({
            _id: userObj._id,
            username: userObj.username,
            name: userObj.name,
            role: userObj.role,
            department: userObj.department,
            bio: userObj.bio,
        })
    } catch (error) {
        console.error("Error creating user:", error)
        res.status(500).json({ message: "Server Error" })
    }
};

module.exports = {
    getUsers,
    getUserById,
    findUserByName,
    updateUserProfile,
    updateUserAdmin,
    deleteUser,
    createFaculty,
    createClubLeader,
    createStudent,
    getFaculty,
    searchFaculty,
    fixFacultyAssignments,
    getUsersByRole,
    getUserProfile,
    updateUserProfileLegacy,
    updateNotificationSettings,
    changePassword,
    changePasswordLegacy,
    getClubLeaderUsers,
    getStudentUsers,
    createUser
};