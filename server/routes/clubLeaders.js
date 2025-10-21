const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Club = require('../models/Club');
const { protect, faculty } = require('../middleware/auth');

// @desc    Get all club leaders for faculty's clubs
// @route   GET /api/club-leaders
// @access  Private (Faculty)
router.get('/', protect, faculty, async (req, res) => {
    try {
        // Get clubs monitored by this faculty
        const clubs = await Club.find({ faculty: req.user._id });
        const clubIds = clubs.map(club => club._id);
        
        // Get all club leaders for these clubs
        const clubLeaders = await User.find({ 
            role: 'clubLeader',
            club: { $in: clubIds }
        }).populate('club', 'name');
        
        res.json(clubLeaders);
    } catch (error) {
        console.error('Error fetching club leaders:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Create a new club leader
// @route   POST /api/club-leaders
// @access  Private (Faculty)
router.post('/', protect, faculty, async (req, res) => {
    const { name, department, username, clubId } = req.body;
    
    try {
        // Check if user exists
        const userExists = await User.findOne({ username });
        
        if (userExists) {
            return res.status(400).json({ message: 'Username already taken' });
        }
        
        // Verify that the faculty is assigned to this club
        const club = await Club.findOne({ _id: clubId, faculty: req.user._id });
        
        if (!club) {
            return res.status(403).json({ message: 'You are not authorized to assign a leader to this club' });
        }
        
        // Check if club already has a leader
        const existingLeader = await User.findOne({ club: clubId, role: 'clubLeader' });
        
        if (existingLeader) {
            return res.status(400).json({ message: 'This club already has a club leader' });
        }
        
        // Generate a default password (can be changed later)
        const defaultPassword = 'Kmit123@';
        
        // Create club leader
        const clubLeader = await User.create({
            name,
            department,
            username,
            password: defaultPassword,
            role: 'clubLeader',
            club: clubId,
            createdBy: req.user._id
        });
        
        // Update the club with the new leader
        club.leader = clubLeader._id;
        await club.save();
        
        // Return the created club leader without password
        const leaderResponse = {
            _id: clubLeader._id,
            name: clubLeader.name,
            department: clubLeader.department,
            username: clubLeader.username,
            role: clubLeader.role,
            club: club
        };
        
        res.status(201).json(leaderResponse);
    } catch (error) {
        console.error('Error creating club leader:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Delete a club leader
// @route   DELETE /api/club-leaders/:id
// @access  Private (Faculty)
router.delete('/:id', protect, faculty, async (req, res) => {
    try {
        const clubLeader = await User.findById(req.params.id);
        
        if (!clubLeader) {
            return res.status(404).json({ message: 'Club leader not found' });
        }
        
        // Verify that the faculty is assigned to the same club as the leader
        const club = await Club.findOne({ 
            _id: clubLeader.club, 
            faculty: req.user._id 
        });
        
        if (!club) {
            return res.status(403).json({ message: 'You are not authorized to delete this club leader' });
        }
        
        // Remove the leader reference from the club
        club.leader = null;
        await club.save();
        
        // Delete the club leader
        await clubLeader.remove();
        
        res.json({ message: 'Club leader removed successfully' });
    } catch (error) {
        console.error('Error deleting club leader:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;