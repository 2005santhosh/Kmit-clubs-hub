const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const mongoose = require('mongoose');
const User = require('../models/User');
const Event = require('../models/Event');
const Reward = require('../models/Reward');
const Club = require('../models/Club');

// Helper to safely get club name (with fallback query if populate fails)
async function getClubName(clubId) {
  if (!clubId || !mongoose.Types.ObjectId.isValid(clubId)) {
    return null;
  }

  // First, try direct query (bypasses populate issues)
  try {
    const club = await Club.findById(clubId).select('name').lean();
    return club ? club.name : null;
  } catch (error) {
    console.error(`[CLUB NAME LOOKUP ERROR] for ID ${clubId}:`, error);
    return null;
  }
}

// Get user recent activity
router.get('/', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate('eventsAttended', 'title date')
            .populate('rewards', 'name points date')
            // Don't populate clubs here - handle manually below
            .select('clubs eventsAttended rewards username _id createdAt')
            .lean();
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const activities = [];
        
        // Add club memberships (manual club name lookup)
        if (user.clubs && user.clubs.length > 0) {
            for (const club of user.clubs) {
                const clubName = await getClubName(club._id);
                if (clubName) {
                    // Use joinDate if available, fallback to user createdAt
                    const activityDate = club.joinDate || user.createdAt || new Date();
                    activities.push({
                        date: activityDate,
                        description: `Joined ${clubName}`,
                        type: 'club',
                        points: 10
                    });
                    console.log(`[RECENT ACTIVITY] Club join for ${user.username}: ${clubName} on ${activityDate}`);
                } else {
                    console.warn(`[RECENT ACTIVITY] Club without valid ID or name for user ${user.username}:`, club._id);
                }
            }
        }
        
        // Add events attended
        if (user.eventsAttended && user.eventsAttended.length > 0) {
            user.eventsAttended.forEach(event => {
                activities.push({
                    date: event.date || new Date(),
                    description: `Attended ${event.title || 'an event'}`,
                    type: 'event',
                    points: 5
                });
            });
        }
        
        // Add rewards earned
        if (user.rewards && user.rewards.length > 0) {
            user.rewards.forEach(reward => {
                activities.push({
                    date: reward.date || new Date(),
                    description: `Earned reward: ${reward.name || 'a reward'}`,
                    type: 'reward',
                    points: reward.points || 0
                });
            });
        }
        
        // Sort activities by date (newest first)
        activities.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Return only the last 10 activities
        const recentActivities = activities.slice(0, 10);
        
        console.log(`[RECENT ACTIVITY] Returning ${recentActivities.length} activities for user ${req.user.id}:`, recentActivities.map(a => ({ desc: a.description, date: a.date })));
        
        res.json(recentActivities);
    } catch (error) {
        console.error('Error fetching user recent activity:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;