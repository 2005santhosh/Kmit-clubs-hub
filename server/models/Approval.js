const mongoose = require('mongoose');

const approvalSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ['event', 'budget', 'leader', 'membership']
    },
    title: {
        type: String,
        required: function() {
            return this.type === 'event';
        }
    },
    description: {
        type: String
    },
    club: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Club',
        required: true
    },
    clubName: {
        type: String
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    requestedByName: {
        type: String
    },
    faculty: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Event-specific fields
    date: {
        type: Date
    },
    venue: {
        type: String
    },
    budget: {
        type: Number
    },
    // Budget-specific fields
    amount: {
        type: Number
    },
    purpose: {
        type: String
    },
    // Leader-specific fields
    name: {
        type: String
    },
    endorsements: {
        type: Number,
        default: 0
    },
    // Membership-specific fields
    username: {
        type: String
    },
    // Approval details
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedByName: {
        type: String
    },
    approvedAt: {
        type: Date
    },
    rejectionReason: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Pre-save middleware to populate clubName and requestedByName
approvalSchema.pre('save', async function(next) {
    try {
        if (this.isModified('club') && !this.clubName) {
            const club = await mongoose.model('Club').findById(this.club);
            if (club) {
                this.clubName = club.name;
            }
        }
        
        if (this.isModified('requestedBy') && !this.requestedByName) {
            const user = await mongoose.model('User').findById(this.requestedBy);
            if (user) {
                this.requestedByName = user.name;
            }
        }
        
        next();
    } catch (error) {
        next(error);
    }
});

module.exports = mongoose.model('Approval', approvalSchema);