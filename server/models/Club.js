const mongoose = require('mongoose');

const clubSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['technical', 'cultural', 'literary', 'arts', 'social-service', 'sports', 'other']
  },
  logo: {
    type: String,
    default: ''
  },
  mission: {
    type: String,
    required: true
  },
  vision: {
    type: String,
    required: true
  },
  facultyCoordinator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  president: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  vicePresident: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  secretary: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  treasurer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  members: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['member', 'officer', 'president', 'vice-president', 'secretary', 'treasurer'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'pending'],
      default: 'pending'
    }
  }],
  events: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  establishedDate: {
    type: Date,
    required: true
  },
  budget: {
    allocated: {
      type: Number,
      default: 0
    },
    spent: {
      type: Number,
      default: 0
    }
  },
  contact: {
    email: String,
    phone: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Club', clubSchema);