const mongoose = require('mongoose');

const clubSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['technical', 'technology', 'cultural', 'sports', 'social', 'academic', 'literary', 'general'],
        default: 'general'
    },
    faculty: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    leader: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    members: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        role: {
            type: String,
            enum: ['president', 'vice-president', 'associate-president', 'public-relations', 'human-resources', 'secretary', 'treasurer', 'documentation-head', 'photography', 'content-creation', 'digital-head', 'coordinator-incharge', 'member'],
            default: 'member'
        },
        joinDate: {
            type: Date,
            default: Date.now
        }
    }],
    events: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event'
    }],
    bannerImage: {
        type: String,
        default: null
    },
    registerLink: {  // New field for registration link
        type: String,
        default: null
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Club', clubSchema);