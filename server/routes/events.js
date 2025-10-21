const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Event = require('../models/Event');
const Club = require('../models/Club');

// @desc    Get all events
// @route   GET /api/events
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { status, limit, club } = req.query;
    const query = {};
    
    // If club is provided, filter by club
    if (club) {
      query.clubId = club;
    }
    
    // If status is provided, filter by status
    if (status) {
      query.status = status;
    }
    
    let events = Event.find(query)
      .populate('clubId', 'name')
      .populate('organizer', 'name');
    
    if (limit) {
      events = events.limit(parseInt(limit));
    }
    
    events = await events.sort({ date: -1 });
    
    res.json(events);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Get single event
// @route   GET /api/events/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('clubId', 'name')
      .populate('organizer', 'name');
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    res.json(event);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Create an event
// @route   POST /api/events
// @access  Private (Club Leader)
router.post('/', protect, authorize('clubLeader'), async (req, res) => {
  try {
    console.log('Event creation request received:', req.body);
    
    const { 
      title, 
      description, 
      clubId, 
      eventType, 
      location,
      date, 
      startTime, 
      endTime, 
      maxParticipants,
      entryPrice,
      budget,
      thumbnail
    } = req.body;
    
    // Validate required fields
    const requiredFields = ['title', 'description', 'clubId', 'eventType', 'location', 'date', 'startTime', 'endTime'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }
    
    // Validate eventType
    const validEventTypes = ['workshop', 'seminar', 'competition', 'cultural', 'sports', 'meeting', 'other'];
    if (!validEventTypes.includes(eventType)) {
      return res.status(400).json({ 
        message: `Invalid event type. Must be one of: ${validEventTypes.join(', ')}` 
      });
    }
    
    // Validate date format
    let eventDate;
    try {
      eventDate = new Date(date);
      if (isNaN(eventDate.getTime())) {
        throw new Error('Invalid date');
      }
    } catch (error) {
      return res.status(400).json({ message: 'Invalid date format. Please use a valid date.' });
    }
    
    // Validate time format (simple check for HH:MM format)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return res.status(400).json({ 
        message: 'Invalid time format. Please use HH:MM format (e.g., 14:30).' 
      });
    }
    
    // Validate maxParticipants
    const participants = maxParticipants ? parseInt(maxParticipants) : 0;
    if (isNaN(participants) || participants < 0) {
      return res.status(400).json({ 
        message: 'Max participants must be a positive number.' 
      });
    }
    
    // Validate entryPrice
    const price = entryPrice ? parseFloat(entryPrice) : 0;
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ 
        message: 'Entry price must be a positive number.' 
      });
    }
    
    // Validate budget
    const requestedBudget = budget ? parseFloat(budget) : 0;
    if (isNaN(requestedBudget) || requestedBudget < 0) {
      return res.status(400).json({ 
        message: 'Requested budget must be a positive number.' 
      });
    }
    
    // Create new event
    const newEvent = new Event({
      title: title.trim(),
      description: description.trim(),
      clubId,
      organizer: req.user._id,
      eventType,
      venue: location.trim(),
      date: eventDate,
      startTime,
      endTime,
      maxParticipants: participants,
      entryPrice: price,
      budget: {
        requested: requestedBudget,
        approved: 0 // Always set to 0 on creation
      },
      thumbnail: thumbnail || ''
    });
    
    console.log('Saving new event:', newEvent);
    const event = await newEvent.save();
    console.log('Event saved successfully:', event);
    
    // Add event to club's events array
    await Club.findByIdAndUpdate(clubId, {
      $push: { events: event._id }
    });
    
    // Populate club and organizer info for response
    const populatedEvent = await Event.findById(event._id)
      .populate('clubId', 'name')
      .populate('organizer', 'name');
    
    res.status(201).json(populatedEvent);
  } catch (error) {
    console.error('Event creation error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    
    // Handle other errors
    res.status(500).json({ message: 'Failed to save event. Please try again.' });
  }
});

// @desc    Update an event
// @route   PUT /api/events/:id
// @access  Private (Club Leader)
router.put('/:id', protect, authorize('clubLeader'), async (req, res) => {
  try {
    console.log('Event update request received:', req.body);
    
    let event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Check if user is authorized to update this event
    const isAdmin = req.user.systemRole === 'admin';
    const isFaculty = req.user.systemRole === 'faculty';
    const isClubLeader = req.user.systemRole === 'clubLeader';
    
    let isAuthorized = isAdmin;
    
    // If not admin, check if user is faculty monitoring this club
    if (!isAuthorized && isFaculty) {
      const club = await Club.findById(event.clubId);
      isAuthorized = club && club.faculty && club.faculty.toString() === req.user._id.toString();
    }
    
    // If not admin or faculty, check if user is club leader of this club
    if (!isAuthorized && isClubLeader) {
      const club = await Club.findById(event.clubId);
      isAuthorized = club && club.leader && club.leader.toString() === req.user._id.toString();
    }
    
    // If not admin, faculty, or club leader, check if user is the event organizer
    if (!isAuthorized) {
      isAuthorized = event.organizer.toString() === req.user._id.toString();
    }
    
    if (!isAuthorized) {
      return res.status(403).json({ message: 'Not authorized to update this event' });
    }
    
    const { 
      title, 
      description, 
      clubId, 
      eventType, 
      location,
      date, 
      startTime, 
      endTime, 
      maxParticipants,
      entryPrice,
      budget,
      thumbnail,
      status
    } = req.body;
    
    // Validate required fields
    const requiredFields = ['title', 'description', 'eventType', 'location', 'date', 'startTime', 'endTime'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }
    
    // Validate eventType
    const validEventTypes = ['workshop', 'seminar', 'competition', 'cultural', 'sports', 'meeting', 'other'];
    if (!validEventTypes.includes(eventType)) {
      return res.status(400).json({ 
        message: `Invalid event type. Must be one of: ${validEventTypes.join(', ')}` 
      });
    }
    
    // Validate date format
    let eventDate;
    try {
      eventDate = new Date(date);
      if (isNaN(eventDate.getTime())) {
        throw new Error('Invalid date');
      }
    } catch (error) {
      return res.status(400).json({ message: 'Invalid date format. Please use a valid date.' });
    }
    
    // Validate time format (simple check for HH:MM format)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return res.status(400).json({ 
        message: 'Invalid time format. Please use HH:MM format (e.g., 14:30).' 
      });
    }
    
    // Validate maxParticipants
    const participants = maxParticipants ? parseInt(maxParticipants) : 0;
    if (isNaN(participants) || participants < 0) {
      return res.status(400).json({ 
        message: 'Max participants must be a positive number.' 
      });
    }
    
    // Validate entryPrice
    const price = entryPrice ? parseFloat(entryPrice) : 0;
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ 
        message: 'Entry price must be a positive number.' 
      });
    }
    
    // Validate budget
    const requestedBudget = budget ? parseFloat(budget) : event.budget.requested;
    if (isNaN(requestedBudget) || requestedBudget < 0) {
      return res.status(400).json({ 
        message: 'Requested budget must be a positive number.' 
      });
    }
    
    // Prepare update object
    const updateData = {
      title: title.trim(),
      description: description.trim(),
      eventType,
      venue: location.trim(),
      date: eventDate,
      startTime,
      endTime,
      maxParticipants: participants,
      entryPrice: price,
      budget: {
        requested: requestedBudget,
        approved: event.budget.approved // Keep existing approved value
      },
      thumbnail: thumbnail || event.thumbnail
    };
    
    // Add clubId if provided
    if (clubId) {
      updateData.clubId = clubId;
    }
    
    // Add status if provided (for admin)
    if (status && isAdmin) {
      const validStatuses = ['pending', 'approved', 'rejected', 'completed', 'cancelled'];
      if (validStatuses.includes(status)) {
        updateData.status = status;
      } else {
        return res.status(400).json({ message: 'Invalid status' });
      }
    }
    
    let updatedEvent = await Event.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('clubId', 'name')
      .populate('organizer', 'name');
    
    // If clubId changed, update clubs' events arrays
    if (clubId && clubId !== event.clubId.toString()) {
      // Remove from old club
      await Club.findByIdAndUpdate(event.clubId, {
        $pull: { events: req.params.id }
      });
      
      // Add to new club
      await Club.findByIdAndUpdate(clubId, {
        $push: { events: req.params.id }
      });
      
      // Refresh populated event
      updatedEvent = await Event.findById(req.params.id)
        .populate('clubId', 'name')
        .populate('organizer', 'name');
    }
    
    console.log('Event updated successfully:', updatedEvent);
    res.json(updatedEvent);
  } catch (error) {
    console.error('Event update error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    
    // Handle other errors
    res.status(500).json({ message: 'Failed to update event. Please try again.' });
  }
});

// @desc    Delete an event
// @route   DELETE /api/events/:id
// @access  Private (Club Leader)
router.delete('/:id', protect, authorize('clubLeader'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Check if user is authorized to delete this event
    const isAdmin = req.user.systemRole === 'admin';
    const isFaculty = req.user.systemRole === 'faculty';
    const isClubLeader = req.user.systemRole === 'clubLeader';
    
    let isAuthorized = isAdmin;
    
    // If not admin, check if user is faculty monitoring this club
    if (!isAuthorized && isFaculty) {
      const club = await Club.findById(event.clubId);
      isAuthorized = club && club.faculty && club.faculty.toString() === req.user._id.toString();
    }
    
    // If not admin or faculty, check if user is club leader of this club
    if (!isAuthorized && isClubLeader) {
      const club = await Club.findById(event.clubId);
      isAuthorized = club && club.leader && club.leader.toString() === req.user._id.toString();
    }
    
    // If not admin, faculty, or club leader, check if user is the event organizer
    if (!isAuthorized) {
      isAuthorized = event.organizer.toString() === req.user._id.toString();
    }
    
    if (!isAuthorized) {
      return res.status(403).json({ message: 'Not authorized to delete this event' });
    }
    
    // Remove event from club's events array
    await Club.findByIdAndUpdate(event.clubId, {
      $pull: { events: event._id }
    });
    
    // Delete the event
    await Event.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Event removed' });
  } catch (error) {
    console.error('Event deletion error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Approve an event
// @route   PATCH /api/events/:id/approve
// @access  Private (Admin/Faculty)
router.patch('/:id/approve', protect, authorize('admin,faculty'), async (req, res) => {
  try {
    const { approvalNotes, approvedBudget } = req.body;
    
    let event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Authorization check
    const isAdmin = req.user.systemRole === 'admin';
    const isFaculty = req.user.systemRole === 'faculty';
    
    let isAuthorized = isAdmin;
    
    if (!isAuthorized && isFaculty) {
      const club = await Club.findById(event.clubId);
      isAuthorized = club && club.faculty && club.faculty.toString() === req.user._id.toString();
    }
    
    if (!isAuthorized) {
      return res.status(403).json({ message: 'Not authorized to approve this event' });
    }
    
    if (event.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending events can be approved' });
    }
    
    event.status = 'approved';
    event.approvedBy = req.user._id;
    event.approvalNotes = approvalNotes || 'Approved by admin';
    
    if (approvedBudget !== undefined) {
      event.budget.approved = parseFloat(approvedBudget);
    }
    
    await event.save();
    
    const populatedEvent = await Event.findById(event._id)
      .populate('clubId', 'name')
      .populate('organizer', 'name username');
    
    res.json(populatedEvent);
  } catch (error) {
    console.error('Error approving event:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Reject an event
// @route   PATCH /api/events/:id/reject
// @access  Private (Admin/Faculty)
router.patch('/:id/reject', protect, authorize('admin,faculty'), async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    
    let event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Authorization check (same as approve)
    const isAdmin = req.user.systemRole === 'admin';
    const isFaculty = req.user.systemRole === 'faculty';
    
    let isAuthorized = isAdmin;
    
    if (!isAuthorized && isFaculty) {
      const club = await Club.findById(event.clubId);
      isAuthorized = club && club.faculty && club.faculty.toString() === req.user._id.toString();
    }
    
    if (!isAuthorized) {
      return res.status(403).json({ message: 'Not authorized to reject this event' });
    }
    
    if (event.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending events can be rejected' });
    }
    
    event.status = 'rejected';
    event.approvalNotes = rejectionReason || 'Rejected by admin';
    
    await event.save();
    
    const populatedEvent = await Event.findById(event._id)
      .populate('clubId', 'name')
      .populate('organizer', 'name username');
    
    res.json(populatedEvent);
  } catch (error) {
    console.error('Error rejecting event:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Complete an event
// @route   PATCH /api/events/:id/complete
// @access  Private (Admin/Faculty/Club Leader)
router.patch('/:id/complete', protect, authorize('admin,faculty,clubLeader'), async (req, res) => {
  try {
    let event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Authorization check (same as delete)
    const isAdmin = req.user.systemRole === 'admin';
    const isFaculty = req.user.systemRole === 'faculty';
    const isClubLeader = req.user.systemRole === 'clubLeader';
    
    let isAuthorized = isAdmin;
    
    if (!isAuthorized && isFaculty) {
      const club = await Club.findById(event.clubId);
      isAuthorized = club && club.faculty && club.faculty.toString() === req.user._id.toString();
    }
    
    if (!isAuthorized && isClubLeader) {
      const club = await Club.findById(event.clubId);
      isAuthorized = club && club.leader && club.leader.toString() === req.user._id.toString();
    }
    
    if (!isAuthorized) {
      isAuthorized = event.organizer.toString() === req.user._id.toString();
    }
    
    if (!isAuthorized) {
      return res.status(403).json({ message: 'Not authorized to complete this event' });
    }
    
    if (event.status !== 'approved') {
      return res.status(400).json({ message: 'Only approved events can be completed' });
    }
    
    event.status = 'completed';
    
    await event.save();
    
    const populatedEvent = await Event.findById(event._id)
      .populate('clubId', 'name')
      .populate('organizer', 'name username');
    
    res.json(populatedEvent);
  } catch (error) {
    console.error('Error completing event:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Cancel an event
// @route   PATCH /api/events/:id/cancel
// @access  Private (Admin/Faculty/Club Leader)
router.patch('/:id/cancel', protect, authorize('admin,faculty,clubLeader'), async (req, res) => {
  try {
    const { cancellationReason } = req.body;
    
    let event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Authorization check (same as delete)
    const isAdmin = req.user.systemRole === 'admin';
    const isFaculty = req.user.systemRole === 'faculty';
    const isClubLeader = req.user.systemRole === 'clubLeader';
    
    let isAuthorized = isAdmin;
    
    if (!isAuthorized && isFaculty) {
      const club = await Club.findById(event.clubId);
      isAuthorized = club && club.faculty && club.faculty.toString() === req.user._id.toString();
    }
    
    if (!isAuthorized && isClubLeader) {
      const club = await Club.findById(event.clubId);
      isAuthorized = club && club.leader && club.leader.toString() === req.user._id.toString();
    }
    
    if (!isAuthorized) {
      isAuthorized = event.organizer.toString() === req.user._id.toString();
    }
    
    if (!isAuthorized) {
      return res.status(403).json({ message: 'Not authorized to cancel this event' });
    }
    
    if (event.status === 'completed' || event.status === 'cancelled') {
      return res.status(400).json({ message: 'Event cannot be cancelled' });
    }
    
    event.status = 'cancelled';
    event.approvalNotes = cancellationReason || 'Cancelled by admin';
    
    await event.save();
    
    const populatedEvent = await Event.findById(event._id)
      .populate('clubId', 'name')
      .populate('organizer', 'name username');
    
    res.json(populatedEvent);
  } catch (error) {
    console.error('Error cancelling event:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Register for an event
// @route   POST /api/events/:id/register
// @access  Private
router.post('/:id/register', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('clubId', 'name');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if event is full
    if (event.maxParticipants > 0 && event.registeredParticipants.length >= event.maxParticipants) {
      return res.status(400).json({ message: 'Event is full' });
    }

    // Check if user already registered
    const alreadyRegistered = event.registeredParticipants.some(p => 
      p.userId && p.userId.toString() === req.user._id.toString()
    );

    if (alreadyRegistered) {
      return res.status(400).json({ message: 'Already registered for this event' });
    }

    // Add user to registered participants
    event.registeredParticipants.push({
      userId: req.user._id,
      registeredAt: new Date()
    });

    await event.save();

    // Award points to user
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { points: 10 } },
      { new: true }
    ).select('points');

    // Emit socket event for real-time update if available
    const reqApp = req.app;
    if (reqApp.get('io')) {
      reqApp.get('io').to(req.user._id.toString()).emit('points-updated', {
        userId: req.user._id,
        points: user.points,
        pointsEarned: 10,
        progressPercentage: Math.min(100, (user.points / 200) * 100)
      });
    }

    res.json({ 
      message: 'Registered successfully',
      event,
      points: user.points
    });
  } catch (error) {
    console.error('Error registering for event:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;