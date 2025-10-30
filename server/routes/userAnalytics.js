const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');

// Get user analytics
router.get('/analytics', protect, async (req, res) => {
    try {
        console.log(`Fetching analytics for user ID: ${req.user.id}`); // Debug log
        
        const user = await User.findById(req.user.id)
            .populate('clubs._id', 'name')  // Populate nested club refs
            .populate('eventsAttended', 'title date')
            .populate('rewards', 'name points date')
            .lean();  // Use lean() for faster queries
        
        if (!user) {
            console.error('User not found for ID:', req.user.id);
            return res.status(404).json({ message: 'User not found' });
        }
        
        console.log('User clubs data:', user.clubs); // Debug: Log raw clubs array
        
        // Safely calculate clubs joined (handle non-array edge cases)
        let clubsJoined = 0;
        if (Array.isArray(user.clubs) && user.clubs.length > 0) {
            clubsJoined = user.clubs.length;
        } else if (user.club) {  // Fallback to legacy single club
            clubsJoined = 1;
        }
        
        // Get events attended count
        const eventsAttended = Array.isArray(user.eventsAttended) ? user.eventsAttended.length : 0;
        
        // Get reward points
        const rewardPoints = user.points || 0;
        
        // Calculate average rating (ensure ratings is array)
        let averageRating = '0.0';
        if (Array.isArray(user.ratings) && user.ratings.length > 0) {
            const sum = user.ratings.reduce((total, rating) => total + (rating.value || 0), 0);
            averageRating = (sum / user.ratings.length).toFixed(1);
        }
        
        const analyticsData = {
            clubsJoined,
            eventsAttended,
            rewardPoints,
            averageRating
        };
        
        console.log('Analytics response:', analyticsData); // Debug log
        
        res.json(analyticsData);
    } catch (error) {
        console.error('Error fetching user analytics:', error); // Enhanced logging
        res.status(500).json({ message: 'Server Error', details: error.message }); // Expose details for debugging
    }
});

// Get user points progress (enhanced with dates from clubs, events, rewards)
router.get('/points', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate('rewards', 'points date')
            .populate('eventsAttended', 'date')  // For event dates
            .populate('clubs._id', 'name')       // For club names if needed
            .select('clubs rewards eventsAttended points createdAt');  // Include createdAt as fallback
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Generate labels for the last 6 months
        const labels = [];
        const data = [];
        const now = new Date();
        
        for (let i = 5; i >= 0; i--) {
            const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);  // End of month
            labels.push(monthEnd.toLocaleDateString('en-US', { month: 'short' }));
            
            // Calculate cumulative points up to end of this month
            let cumulativePoints = 0;
            
            // Base points for clubs (add 10 per club if joinDate <= monthEnd)
            if (user.clubs && user.clubs.length > 0) {
                user.clubs.forEach(club => {
                    const joinDate = club.joinDate || user.createdAt || new Date(0);  // Fallback to createdAt or epoch
                    if (new Date(joinDate) <= monthEnd) {
                        cumulativePoints += 10;  // 10 per club
                    }
                });
            }
            
            // Points from events attended up to this month (5 per event)
            if (user.eventsAttended && user.eventsAttended.length > 0) {
                user.eventsAttended.forEach(event => {
                    const eventDate = event.date || new Date(0);
                    if (new Date(eventDate) <= monthEnd) {
                        cumulativePoints += 5;
                    }
                });
            }
            
            // Points from rewards earned up to this month
            if (user.rewards && user.rewards.length > 0) {
                user.rewards.forEach(reward => {
                    const rewardDate = reward.date || new Date(0);
                    if (new Date(rewardDate) <= monthEnd) {
                        cumulativePoints += reward.points || 0;
                    }
                });
            }
            
            data.push(cumulativePoints);
        }
        
        console.log(`[POINTS PROGRESS] For user ${req.user.id}: labels=${labels.join(', ')}, data=${data.join(', ')}`);
        
        res.json({
            labels,
            data
        });
    } catch (error) {
        console.error('Error fetching user points progress:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;