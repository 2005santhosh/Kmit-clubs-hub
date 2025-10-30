// models/ClubActivityReport.js
const mongoose = require('mongoose');

const ClubActivityReportSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide a report title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please provide a description'],
    trim: true
  },
  club: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Club',
    required: true
  },
  type: {
    type: String,
    required: [true, 'Please specify the report type'],
    enum: ['event', 'monthly', 'annual', 'financial']
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  submittedDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedDate: {
    type: Date
  },
  content: {
    type: String, // Stored as JSON string
    default: null
  },
  attachments: [{
    filename: {
      type: String,
      required: true
    },
    path: {
      type: String,
      required: true
    },
    mimetype: {
      type: String
    },
    size: {
      type: Number
    }
  }]
});

module.exports = mongoose.model('ClubActivityReport', ClubActivityReportSchema);