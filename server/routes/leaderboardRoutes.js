// routes/leaderboardRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const mongoose = require('mongoose');
const User = require('../models/User');
const Club = require('../models/Club');

// Helper function to extract club names (safe extraction from sub-docs)
async function getClubNames(userClubs) {
  if (!userClubs || userClubs.length === 0) {
    return [];
  }

  // Extract valid ObjectId strings from sub-docs
  const clubIds = userClubs
    .map(club => {
      if (club && club._id && mongoose.Types.ObjectId.isValid(club._id)) {
        return club._id.toString();
      }
      return null;
    })
    .filter(id => id);

  if (clubIds.length === 0) {
    return [];
  }

  console.log(`[CLUB NAMES] Querying for IDs: ${clubIds.join(', ')}`);

  // Query clubs by IDs
  const clubs = await Club.find({ _id: { $in: clubIds } })
    .select('name')
    .lean();

  // Map back to names (order may not match, but for display it's fine)
  const clubNames = clubs.map(club => club.name).filter(name => name && name.trim());

  console.log(`[CLUB NAMES] Found names: ${clubNames.join(', ')}`);

  return clubNames;
}

// GET /api/leaderboard (protected route)
router.get('/', protect, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    console.log(`[LEADERBOARD] Fetching for current user ID: ${currentUserId}`);

    // Fetch students (lean for plain objects, include clubs sub-docs)
    const students = await User.find({ systemRole: 'student' })
      .lean()  // Plain JS objects
      .sort({ points: -1 })
      .limit(20)
      .select('name points clubs _id systemRole');

    console.log(`[LEADERBOARD] Found ${students.length} students`);

    // Async process each for club names
    const leaderboardPromises = students.map(async (user, index) => {
      const clubNames = await getClubNames(user.clubs);

      return {
        rank: index + 1,
        name: user.name,
        points: user.points || 0,
        clubs: clubNames,  // Array of club names
        isCurrentUser: user._id.toString() === currentUserId
      };
    });

    const leaderboard = await Promise.all(leaderboardPromises);

    console.log(`[LEADERBOARD] Processed (first 3):`, JSON.stringify(leaderboard.slice(0, 3), null, 2));

    res.json(leaderboard);
  } catch (error) {
    console.error('[LEADERBOARD ERROR]', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Debug endpoint: GET /api/leaderboard/debug/:userId
router.get('/debug/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`[DEBUG CLUBS] Checking user ID: ${userId}`);

    const user = await User.findById(userId)
      .lean()
      .select('name username clubs systemRole _id');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const clubNames = await getClubNames(user.clubs);

    res.json({
      user: {
        name: user.name,
        username: user.username,
        systemRole: user.systemRole,
        clubsRaw: user.clubs,  // Raw sub-docs
        clubsPopulated: clubNames,
        hasClubs: clubNames.length > 0
      }
    });
  } catch (error) {
    console.error('[DEBUG CLUBS ERROR]', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;