const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Reward = require('../models/Reward');

// Get user's earned rewards
router.get('/', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('rewards');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Format the rewards data
        const earnedRewards = user.rewards.map(reward => ({
            _id: reward._id,
            name: reward.name,
            icon: reward.icon,
            description: reward.description,
            points: reward.points,
            earnedDate: reward.date || new Date()
        }));
        
        res.json(earnedRewards);
    } catch (error) {
        console.error('Error fetching earned rewards:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;