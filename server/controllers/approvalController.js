const Approval = require('../models/Approval');
const Club = require('../models/Club');
const User = require('../models/User');
const Event = require('../models/Event');

// @desc    Get all approvals for faculty
// @route   GET /api/approvals/faculty
// @access  Faculty
const getFacultyApprovals = async (req, res) => {
    try {
        // Get faculty ID from the authenticated user
        const facultyId = req.user._id;
        
        // Get query parameters for pagination and filtering
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const type = req.query.type;
        const status = req.query.status;
        const club = req.query.club;
        
        // Build query
        const query = { faculty: facultyId };
        
        if (type && type !== 'all') {
            query.type = type;
        }
        
        if (status && status !== 'all') {
            query.status = status;
        }
        
        if (club && club !== 'all') {
            query.club = club;
        }
        
        // Calculate pagination
        const skip = (page - 1) * limit;
        
        // Get approvals with pagination
        const approvals = await Approval.find(query)
            .populate('club', 'name')
            .populate('requestedBy', 'name username')
            .populate('faculty', 'name username')
            .populate('approvedBy', 'name username')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
        // Get total count for pagination
        const total = await Approval.countDocuments(query);
        
        res.json({
            approvals,
            total,
            page,
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Error fetching faculty approvals:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get approval by ID
// @route   GET /api/approvals/:id
// @access  Faculty
const getApprovalById = async (req, res) => {
    try {
        const approval = await Approval.findById(req.params.id)
            .populate('club', 'name')
            .populate('requestedBy', 'name username email')
            .populate('faculty', 'name username email')
            .populate('approvedBy', 'name username email');
        
        if (!approval) {
            return res.status(404).json({ message: 'Approval not found' });
        }
        
        res.json(approval);
    } catch (error) {
        console.error('Error fetching approval by ID:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Create a new approval
// @route   POST /api/approvals
// @access  Club Leader, Faculty
const createApproval = async (req, res) => {
    try {
        const {
            type,
            title,
            description,
            club,
            date,
            venue,
            budget,
            amount,
            purpose,
            name,
            username
        } = req.body;
        
        // Get the authenticated user
        const userId = req.user._id;
        
        // Get the club to find the faculty
        const clubData = await Club.findById(club);
        if (!clubData) {
            return res.status(404).json({ message: 'Club not found' });
        }
        
        // Create approval object based on type
        const approvalData = {
            type,
            club,
            requestedBy: userId,
            faculty: clubData.faculty
        };
        
        // Add type-specific fields
        if (type === 'event') {
            approvalData.title = title;
            approvalData.description = description;
            approvalData.date = date;
            approvalData.venue = venue;
            approvalData.budget = budget;
        } else if (type === 'budget') {
            approvalData.amount = amount;
            approvalData.purpose = purpose;
        } else if (type === 'leader') {
            approvalData.name = name;
        } else if (type === 'membership') {
            approvalData.name = name;
            approvalData.username = username;
        }
        
        // Create the approval
        const approval = await Approval.create(approvalData);
        
        // Populate the response
        const populatedApproval = await Approval.findById(approval._id)
            .populate('club', 'name')
            .populate('requestedBy', 'name username')
            .populate('faculty', 'name username');
        
        res.status(201).json(populatedApproval);
    } catch (error) {
        console.error('Error creating approval:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Update approval status (approve/reject)
// @route   PATCH /api/approvals/:id
// @access  Faculty
const updateApprovalStatus = async (req, res) => {
    try {
        const { status, rejectionReason } = req.body;
        
        const approval = await Approval.findById(req.params.id);
        
        if (!approval) {
            return res.status(404).json({ message: 'Approval not found' });
        }
        
        // Update approval status
        approval.status = status;
        
        if (status === 'approved') {
            approval.approvedBy = req.user._id;
            approval.approvedAt = new Date();
            
            // If it's an event approval, create the event
            if (approval.type === 'event') {
                const eventData = {
                    title: approval.title,
                    description: approval.description,
                    date: approval.date,
                    venue: approval.venue,
                    budget: approval.budget,
                    club: approval.club,
                    organizer: approval.requestedBy,
                    status: 'approved'
                };
                
                await Event.create(eventData);
            }
        } else if (status === 'rejected') {
            approval.rejectionReason = rejectionReason;
        }
        
        await approval.save();
        
        // Populate the response
        const populatedApproval = await Approval.findById(approval._id)
            .populate('club', 'name')
            .populate('requestedBy', 'name username')
            .populate('faculty', 'name username')
            .populate('approvedBy', 'name username');
        
        res.json(populatedApproval);
    } catch (error) {
        console.error('Error updating approval status:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Delete an approval
// @route   DELETE /api/approvals/:id
// @access  Faculty
const deleteApproval = async (req, res) => {
    try {
        const approval = await Approval.findById(req.params.id);
        
        if (!approval) {
            return res.status(404).json({ message: 'Approval not found' });
        }
        
        await approval.remove();
        
        res.json({ message: 'Approval removed' });
    } catch (error) {
        console.error('Error deleting approval:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get approvals with query parameters (for club leader dashboard)
// @route   GET /api/approvals
// @access  Private (Club Leader, Faculty)
const getApprovals = async (req, res) => {
    try {
        const { status, limit } = req.query;
        const query = {};
        
        // If user is club leader, only show approvals for their club
        if (req.user.role === 'clubLeader') {
            const club = await Club.findOne({ leader: req.user._id });
            if (!club) {
                return res.status(404).json({ message: 'Club not found' });
            }
            query.club = club._id;
        }
        
        // If status is provided, filter by status
        if (status) {
            query.status = status;
        }
        
        let approvals = Approval.find(query)
            .populate('club', 'name')
            .populate('requestedBy', 'name');
        
        if (limit) {
            approvals = approvals.limit(parseInt(limit));
        }
        
        approvals = await approvals.sort({ createdAt: -1 });
        
        res.json(approvals);
    } catch (error) {
        console.error('Error fetching approvals:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getFacultyApprovals,
    getApprovalById,
    createApproval,
    updateApprovalStatus,
    deleteApproval,
    getApprovals
};