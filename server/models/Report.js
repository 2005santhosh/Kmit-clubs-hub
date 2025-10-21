const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a report name'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  type: {
    type: String,
    required: [true, 'Please specify the report type'],
    enum: ['users', 'clubs', 'events', 'attendance', 'activity', 'feedback']
  },
  format: {
    type: String,
    required: [true, 'Please specify the report format'],
    enum: ['pdf', 'excel', 'csv']
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  dateFrom: {
    type: Date,
    required: true
  },
  dateTo: {
    type: Date,
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  fileSize: {
    type: String,
    default: 'Unknown'
  },
  parameters: {
    type: Object,
    default: {}
  }
});

module.exports = mongoose.model('Report', ReportSchema);