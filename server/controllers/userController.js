const User = require('../models/User');

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
// @access  Private
const updateUser = async (req, res) => {
    try {
        const { username, name, role, department } = req.body;
        
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Check if username is already taken by another user
        if (username && username !== user.username) {
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                return res.status(400).json({ message: 'Username already taken' });
            }
        }
        
        user.username = username || user.username;
        user.name = name || user.name;
        user.role = role || user.role;
        user.department = department || user.department;
        
        const updatedUser = await user.save();
        
        res.json({
            _id: updatedUser._id,
            username: updatedUser.username,
            role: updatedUser.role,
            name: updatedUser.name,
            department: updatedUser.department,
            club: updatedUser.club
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Admin
const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        await user.remove();
        
        res.json({ message: 'User removed' });
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
        const faculty = await User.find({ role: 'faculty' }).select('-password');
        res.json(faculty);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getUsers,
    getUserById,
    findUserByName,
    updateUser,
    deleteUser,
    createFaculty,
    createClubLeader,
    createStudent,
    getFaculty
};