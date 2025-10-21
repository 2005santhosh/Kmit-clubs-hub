// routes/studentRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Event = require('../models/Event');
const Club = require('../models/Club');
const Reward = require('../models/Reward');
const mongoose = require('mongoose');

// Protect all routes
router.use(protect);

// Get student dashboard stats
router.get('/dashboard/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user with populated clubs and events
    const user = await User.findById(userId)
      .populate('clubs._id', 'name')
      .populate('eventsAttended', 'title date');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Calculate stats
    const clubsJoined = user.clubs ? user.clubs.length : 0;
    const eventsAttended = user.eventsAttended ? user.eventsAttended.length : 0;
    const rewardPoints = user.points || 0;
    
    // Calculate average rating (if ratings exist)
    let averageRating = 0;
    if (user.ratings && user.ratings.length > 0) {
      const sum = user.ratings.reduce((acc, curr) => acc + curr.value, 0);
      averageRating = sum / user.ratings.length;
    }
    
    res.json({
      clubsJoined,
      eventsAttended,
      rewardPoints,
      averageRating: parseFloat(averageRating.toFixed(1))
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Get activity data by period
router.get('/activity', async (req, res) => {
  try {
    const { period } = req.query;
    const userId = req.user.id;
    
    // Get user with populated events
    const user = await User.findById(userId).populate('eventsAttended', 'date');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const now = new Date();
    let labels = [];
    let data = [];
    
    // Determine date range based on period
    let startDate;
    switch (period) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        
        // Create labels for each day
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(now.getDate() - i);
          labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
          
          // Count events for this day
          const dayStart = new Date(date);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(date);
          dayEnd.setHours(23, 59, 59, 999);
          
          const count = user.eventsAttended.filter(event => {
            const eventDate = new Date(event.date);
            return eventDate >= dayStart && eventDate <= dayEnd;
          }).length;
          
          data.push(count);
        }
        break;
        
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        
        // Create labels for each week
        labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
        data = [0, 0, 0, 0];
        
        // Count events per week
        user.eventsAttended.forEach(event => {
          const eventDate = new Date(event.date);
          if (eventDate >= startDate && eventDate <= now) {
            const weekNumber = Math.floor((eventDate - startDate) / (7 * 24 * 60 * 60 * 1000));
            if (weekNumber >= 0 && weekNumber < 4) {
              data[weekNumber]++;
            }
          }
        });
        break;
        
      case 'quarter':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 3);
        
        // Create labels for each month
        labels = ['Month 1', 'Month 2', 'Month 3'];
        data = [0, 0, 0];
        
        // Count events per month
        user.eventsAttended.forEach(event => {
          const eventDate = new Date(event.date);
          if (eventDate >= startDate && eventDate <= now) {
            const monthNumber = Math.floor((eventDate - startDate) / (30 * 24 * 60 * 60 * 1000));
            if (monthNumber >= 0 && monthNumber < 3) {
              data[monthNumber]++;
            }
          }
        });
        break;
        
      case 'year':
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
        
        // Create labels for each month
        labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        data = new Array(12).fill(0);
        
        // Count events per month
        user.eventsAttended.forEach(event => {
          const eventDate = new Date(event.date);
          if (eventDate >= startDate && eventDate <= now) {
            const monthIndex = eventDate.getMonth();
            data[monthIndex]++;
          }
        });
        break;
        
      default:
        return res.status(400).json({ message: 'Invalid period specified' });
    }
    
    res.json({ labels, data });
  } catch (error) {
    console.error('Error fetching activity data:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Get points data
router.get('/points', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user with populated rewards
    const user = await User.findById(userId).populate('rewards', 'date points');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Initialize data arrays
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const earned = new Array(12).fill(0);
    const spent = new Array(12).fill(0);
    
    // Get current year
    const currentYear = new Date().getFullYear();
    
    // Process rewards (points earned)
    user.rewards.forEach(reward => {
      const rewardDate = new Date(reward.date);
      if (rewardDate.getFullYear() === currentYear) {
        const monthIndex = rewardDate.getMonth();
        earned[monthIndex] += reward.points || 0;
      }
    });
    
    // Note: In a real implementation, you would also track points spent
    // For now, we'll leave spent as zeros
    
    res.json({ labels, earned, spent });
  } catch (error) {
    console.error('Error fetching points data:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Get recent activity
router.get('/activity/recent', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user with populated clubs, events, and rewards
    const user = await User.findById(userId)
      .populate('clubs._id', 'name')
      .populate('eventsAttended', 'title date')
      .populate('rewards', 'name date points');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const activities = [];
    
    // Add club memberships
    if (user.clubs && user.clubs.length > 0) {
      user.clubs.forEach(club => {
        activities.push({
          date: club.joinDate || new Date(),
          activity: `Joined ${club._id.name}`,
          type: 'club',
          points: 20 // Points for joining a club
        });
      });
    }
    
    // Add event attendance
    if (user.eventsAttended && user.eventsAttended.length > 0) {
      user.eventsAttended.forEach(event => {
        activities.push({
          date: event.date,
          activity: `Attended ${event.title}`,
          type: 'event',
          points: 10 // Points for attending an event
        });
      });
    }
    
    // Add rewards
    if (user.rewards && user.rewards.length > 0) {
      user.rewards.forEach(reward => {
        activities.push({
          date: reward.date,
          activity: `Earned ${reward.name}`,
          type: 'reward',
          points: reward.points || 0
        });
      });
    }
    
    // Sort activities by date (newest first)
    activities.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Return only the 10 most recent activities
    res.json(activities.slice(0, 10));
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;