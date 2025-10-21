const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Event = require('../models/Event');
const Club = require('../models/Club');

// Get user activity data for charts
router.get('/activity', protect, async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        const user = await User.findById(req.user.id)
            .populate('eventsAttended', 'title date')
            .populate('clubs._id', 'name');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Calculate date range based on period
        const now = new Date();
        let startDate;
        let interval;
        let dateFormat;
        
        switch (period) {
            case 'week':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
                interval = 'day';
                dateFormat = { month: 'short', day: 'numeric' };
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                interval = 'day';
                dateFormat = { month: 'short', day: 'numeric' };
                break;
            case 'quarter':
                startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
                interval = 'week';
                dateFormat = { month: 'short', day: 'numeric' };
                break;
            case 'year':
                startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                interval = 'month';
                dateFormat = { month: 'short' };
                break;
            default:
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                interval = 'day';
                dateFormat = { month: 'short', day: 'numeric' };
        }
        
        // Generate labels and data for the chart
        const labels = [];
        const data = [];
        const dataMap = new Map();
        
        // Initialize data points
        const currentDate = new Date(startDate);
        while (currentDate <= now) {
            const label = currentDate.toLocaleDateString('en-US', dateFormat);
            labels.push(label);
            dataMap.set(label, 0);
            
            // Increment date based on interval
            if (interval === 'day') {
                currentDate.setDate(currentDate.getDate() + 1);
            } else if (interval === 'week') {
                currentDate.setDate(currentDate.getDate() + 7);
            } else if (interval === 'month') {
                currentDate.setMonth(currentDate.getMonth() + 1);
            }
        }
        
        // Count events attended
        if (user.eventsAttended && user.eventsAttended.length > 0) {
            user.eventsAttended.forEach(event => {
                if (event.date >= startDate && event.date <= now) {
                    const eventDate = event.date.toLocaleDateString('en-US', dateFormat);
                    if (dataMap.has(eventDate)) {
                        dataMap.set(eventDate, dataMap.get(eventDate) + 1);
                    }
                }
            });
        }
        
        // Count club memberships (using joinDate)
        if (user.clubs && user.clubs.length > 0) {
            user.clubs.forEach(club => {
                if (club.joinDate >= startDate && club.joinDate <= now) {
                    const joinDate = club.joinDate.toLocaleDateString('en-US', dateFormat);
                    if (dataMap.has(joinDate)) {
                        dataMap.set(joinDate, dataMap.get(joinDate) + 1);
                    }
                }
            });
        }
        
        // Convert map to array
        labels.forEach(label => {
            data.push(dataMap.get(label) || 0);
        });
        
        res.json({
            labels,
            data
        });
    } catch (error) {
        console.error('Error fetching user activity:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;