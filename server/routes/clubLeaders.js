const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect, faculty, authorize } = require('../middleware/auth');  // Changed authorizeRole to authorize (exported name)
const User = require('../models/User');
const Club = require('../models/Club');

// Middleware to get club by ID from params or body (for club-specific routes)
const getClubById = async (req, res, next) => {
    try {
        let clubId;
        if (req.params.clubId) {
            clubId = req.params.clubId;
        } else if (req.body.clubId) {
            clubId = req.body.clubId;
        }
        if (!clubId) {
            return res.status(400).json({ message: 'Club ID is required' });
        }
        const club = await Club.findById(clubId);
        if (!club) {
            return res.status(404).json({ message: 'Club not found' });
        }
        req.club = club;
        next();
    } catch (error) {
        console.error('Error getting club:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get all club leaders (faculty/admin only)
// @route   GET /api/club-leaders
// @access  Private (Faculty/Admin)
router.get('/', protect, authorize(['faculty', 'admin']), async (req, res) => {  // Changed to authorize
    try {
        // Use existing controller logic for consistency
        const leaders = await User.find({ 
            $or: [
                { systemRole: 'clubLeader' },
                { role: 'clubLeader' }
            ]
        })
            .select('-password')
            .populate('clubs._id', 'name')
            .populate('club', 'name')  // Legacy compatibility
            .sort({ createdAt: -1 });

        // Transform for consistent 'role' field
        const transformedLeaders = leaders.map(user => {
            const userObj = user.toObject();
            userObj.role = userObj.systemRole || userObj.role;
            // Add department if missing (for table display)
            if (!userObj.department) userObj.department = 'N/A';
            return userObj;
        });

        res.json(transformedLeaders);
    } catch (error) {
        console.error('Error fetching club leaders:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Create a new club leader (faculty only, for monitored clubs)
// @route   POST /api/club-leaders
// @access  Private (Faculty)
router.post('/', protect, faculty, async (req, res) => {
    try {
        const { name, department, username, clubId } = req.body;

        // Validate required fields
        if (!name || !department || !username || !clubId) {
            return res.status(400).json({ message: 'Name, department, username, and clubId are required' });
        }

        // Check if username already exists
        const userExists = await User.findOne({ username });
        if (userExists) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        // Validate club exists
        const club = await Club.findById(clubId);
        if (!club) {
            return res.status(404).json({ message: 'Club not found' });
        }

        // Optional: Check if faculty monitors this club (implement based on your logic, e.g., via req.user.clubs)
        // if (!req.user.clubs.some(c => c._id.toString() === clubId)) {
        //     return res.status(403).json({ message: 'Not authorized for this club' });
        // }

        // Create club leader with explicit role and default password
        const userData = {
            username,
            name,
            department,
            password: 'Kmit123$',  // Default password (hashed by model's pre-save hook)
            systemRole: 'clubLeader',  // Explicitly set primary role
            role: 'clubLeader',  // Backward compatibility
            // Removed status: 'active' as per model (implicitly active)
            clubs: [{  // Use clubs array for club leaders
                _id: clubId,
                role: 'leader',  // Sub-role in club
                joinDate: new Date()
            }],
            createdBy: req.user._id
        };

        const user = new User(userData);
        await user.save();

        // Populate for response
        await user.populate('clubs._id', 'name');

        // Transform for consistent 'role' field
        const userObj = user.toObject();
        userObj.role = userObj.systemRole || userObj.role;

        res.status(201).json({
            message: 'Club leader created successfully',
            user: userObj
        });
    } catch (error) {
        console.error('Error creating club leader:', error);
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Username already exists' });
        }
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Get a single club leader by ID
// @route   GET /api/club-leaders/:id
// @access  Private (Faculty/Admin)
router.get('/:id', protect, authorize(['faculty', 'admin']), async (req, res) => {  // Changed to authorize
    try {
        if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid club leader ID' });
        }

        const user = await User.findById(req.params.id)
            .select('-password')
            .populate('clubs._id', 'name')
            .populate('club', 'name');

        if (!user || (user.systemRole !== 'clubLeader' && user.role !== 'clubLeader')) {
            return res.status(404).json({ message: 'Club leader not found' });
        }

        // Transform for consistent 'role' field
        const userObj = user.toObject();
        userObj.role = userObj.systemRole || userObj.role;

        res.json(userObj);
    } catch (error) {
        console.error('Error fetching club leader:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Update a club leader (faculty/admin only)
// @route   PUT /api/club-leaders/:id
// @access  Private (Faculty/Admin)
router.put('/:id', protect, authorize(['faculty', 'admin']), async (req, res) => {  // Changed to authorize
    try {
        if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid club leader ID' });
        }

        const { name, department, username, clubId } = req.body;

        const user = await User.findById(req.params.id);
        if (!user || (user.systemRole !== 'clubLeader' && user.role !== 'clubLeader')) {
            return res.status(404).json({ message: 'Club leader not found' });
        }

        // Authorization: Check if faculty is authorized (e.g., same club)
        const userSystemRole = req.user.systemRole || req.user.role;
        if (userSystemRole === 'faculty') {
            const leaderClubId = user.clubs?.[0]?._id || user.club;
            const facultyClubId = req.user.clubs?.[0]?._id || req.user.club;
            if (leaderClubId && facultyClubId && leaderClubId.toString() !== facultyClubId.toString()) {
                return res.status(403).json({ message: 'Not authorized to update this club leader' });
            }
        }

        // Update fields
        if (name) user.name = name;
        if (department) user.department = department;
        if (username && username !== user.username) {
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                return res.status(400).json({ message: 'Username already taken' });
            }
            user.username = username;
        }

        // Handle club update if provided (must be the same club or authorized)
        if (clubId && clubId !== (user.clubs?.[0]?._id || user.club)) {
            const newClub = await Club.findById(clubId);
            if (!newClub) {
                return res.status(400).json({ message: 'Invalid club ID' });
            }
            // Update clubs array
            user.clubs = [{
                _id: clubId,
                role: 'leader',
                joinDate: new Date()
            }];
            user.club = null;  // Clear legacy field
        }

        const updatedUser = await user.save();

        // Populate
        await updatedUser.populate('clubs._id', 'name');

        // Transform
        const userObj = updatedUser.toObject();
        userObj.role = userObj.systemRole || userObj.role;

        res.json({
            message: 'Club leader updated successfully',
            user: userObj
        });
    } catch (error) {
        console.error('Error updating club leader:', error);
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Username already exists' });
        }
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Delete a club leader (faculty/admin only)
// @route   DELETE /api/club-leaders/:id
// @access  Private (Faculty/Admin)
router.delete('/:id', protect, authorize(['faculty', 'admin']), async (req, res) => {  // Changed to authorize
    try {
        if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid club leader ID' });
        }

        const user = await User.findById(req.params.id);
        if (!user || (user.systemRole !== 'clubLeader' && user.role !== 'clubLeader')) {
            return res.status(404).json({ message: 'Club leader not found' });
        }

        // Authorization: Check if faculty is authorized (e.g., same club)
        const userSystemRole = req.user.systemRole || req.user.role;
        if (userSystemRole === 'faculty') {
            const leaderClubId = user.clubs?.[0]?._id || user.club;
            const facultyClubId = req.user.clubs?.[0]?._id || req.user.club;
            if (leaderClubId && facultyClubId && leaderClubId.toString() !== facultyClubId.toString()) {
                return res.status(403).json({ message: 'Not authorized to delete this club leader' });
            }
        }

        await User.findByIdAndDelete(req.params.id);

        res.json({ message: 'Club leader deleted successfully' });
    } catch (error) {
        console.error('Error deleting club leader:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Optional: Get club leaders for a specific club
// @route   GET /api/club-leaders/club/:clubId
router.get('/club/:clubId', protect, authorize(['faculty', 'admin']), getClubById, async (req, res) => {  // Changed to authorize
    try {
        const leaders = await User.find({ 
            systemRole: 'clubLeader',
            'clubs._id': req.club._id
        })
            .select('-password')
            .populate('clubs._id', 'name');

        const transformedLeaders = leaders.map(user => {
            const userObj = user.toObject();
            userObj.role = userObj.systemRole || userObj.role;
            return userObj;
        });

        res.json(transformedLeaders);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;