const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  icon: {
    type: String,
    default: 'fas fa-trophy',
  },
  description: {
    type: String,
    required: true,
  },
  requiredPoints: {
    type: Number,
    required: true,
    min: 0,
  },
  points: {
    type: Number,
    required: true,
    min: 0,
  },
  category: {
    type: String,
    enum: ['club', 'event', 'achievement', 'special'],
    default: 'achievement',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

const Reward = mongoose.model('Reward', rewardSchema);

module.exports = Reward;