const express = require('express');
const router = express.Router();
const Reward = require('../models/Reward');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/rewards
// @desc    Get all rewards
// @access  Public
router.get('/', async (req, res) => {
  try {
    const rewards = await Reward.find({ isActive: true });
    res.json(rewards);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET /api/rewards/earned
// @desc    Get user's earned rewards
// @access  Private
router.get('/earned', protect, async (req, res) => {
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
      requiredPoints: reward.requiredPoints,
      category: reward.category,
      earnedDate: reward.date || new Date()
    }));
    
    res.json(earnedRewards);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   POST /api/rewards/:id/claim
// @desc    Claim a reward
// @access  Private
router.post('/:id/claim', protect, async (req, res) => {
  try {
    const reward = await Reward.findById(req.params.id);
    
    if (!reward) {
      return res.status(404).json({ message: 'Reward not found' });
    }
    
    const user = await User.findById(req.user.id);
    
    // Check if user already has this reward
    if (user.rewards.includes(reward._id)) {
      return res.status(400).json({ message: 'You already have this reward' });
    }
    
    // Check if user has enough points
    if (user.points < reward.requiredPoints) {
      return res.status(400).json({ 
        message: 'Not enough points to claim this reward',
        requiredPoints: reward.requiredPoints,
        userPoints: user.points
      });
    }
    
    // Add reward to user
    user.rewards.push(reward._id);
    await user.save();
    
    // Emit socket event for real-time update
    const reqApp = req.app;
    if (reqApp.get('io')) {
      reqApp.get('io').to(user._id.toString()).emit('reward-claimed', {
        userId: user._id,
        rewardName: reward.name,
        rewardId: reward._id
      });
    }
    
    res.json({ message: 'Reward claimed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   POST /api/rewards
// @desc    Create a new reward
// @access  Private (Admin only)
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { name, icon, description, requiredPoints, points, category } = req.body;
    
    const newReward = new Reward({
      name,
      icon,
      description,
      requiredPoints,
      points,
      category
    });
    
    const reward = await newReward.save();
    res.status(201).json(reward);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});
 
module.exports = router;