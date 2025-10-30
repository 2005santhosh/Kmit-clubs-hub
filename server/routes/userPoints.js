const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');

// Get user points
router.get('/points', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Check if user is in any clubs
        const isInClub = user.clubs && user.clubs.length > 0;
        
        // Default points for being in a club
        let basePoints = 0;
        if (isInClub) {
            basePoints = 10;
        }
        
        // Calculate total points (base points + earned points)
        const totalPoints = (user.points || 0) + basePoints;
        
        // Calculate progress to next level (simple calculation)
        const nextLevelPoints = Math.ceil(totalPoints / 100) * 100;
        const progressPercentage = Math.round((totalPoints % 100) || 0);
        
        res.json({
            totalPoints,
            nextLevelPoints,
            progressPercentage,
            basePoints,
            earnedPoints: user.points || 0,
            isInClub
        });
    } catch (error) {
        console.error('Error fetching user points:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Get user analytics
router.get('/analytics', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Get clubs joined count
        const clubsJoined = user.clubs ? user.clubs.length : 0;
        
        // Get events attended count
        const eventsAttended = user.eventsAttended ? user.eventsAttended.length : 0;
        
        // Get reward points
        const rewardPoints = user.points || 0;
        
        // Calculate average rating
        const averageRating = user.ratings && user.ratings.length > 0 
            ? (user.getAverageRating()).toFixed(1) 
            : '0.0';
        
        res.json({
            clubsJoined,
            eventsAttended,
            rewardPoints,
            averageRating
        });
    } catch (error) {
        console.error('Error fetching user analytics:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});
// Ensure minimum points for club members (call this on fetch if needed)
router.post('/ensure-minimum-points', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let updated = false;
    if (Array.isArray(user.clubs) && user.clubs.length > 0 && user.points < 10) {
      user.points = 10;
      await user.save();
      updated = true;
      console.log(`Enforced 10 points for club member: ${user.username}`);
    }

    res.json({
      points: user.points,
      wasUpdated: updated,
      message: updated ? 'Minimum points enforced!' : 'Points already sufficient.'
    });
  } catch (error) {
    console.error('Error ensuring minimum points:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;