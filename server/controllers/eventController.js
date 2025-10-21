const Event = require('../models/Event');
const Club = require('../models/Club');
const User = require('../models/User');

// @desc    Get all events
// @route   GET /api/events
// @access  Public
const getEvents = async (req, res) => {
  try {
    // If clubId is provided as a query parameter, filter events by club
    if (req.query.clubId) {
      const events = await Event.find({ clubId: req.query.clubId })
        .populate('clubId', 'name')
        .populate('organizer', 'name username')
        .sort({ date: 1 });
      
      return res.json(events);
    }
    
    // Otherwise, get all events
    const events = await Event.find({})
      .populate('clubId', 'name')
      .populate('organizer', 'name username')
      .sort({ date: 1 });
    
    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get single event
// @route   GET /api/events/:id
// @access  Public
const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('clubId', 'name')
      .populate('organizer', 'name username')
      .populate('registeredParticipants', 'name username');
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    res.json(event);
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create new event
// @route   POST /api/events
// @access  Private
const createEvent = async (req, res) => {
  try {
    // Add the current user as the organizer
    req.body.organizer = req.user._id;
    
    const event = await Event.create(req.body);
    
    // Add event to club's events array
    await Club.findByIdAndUpdate(req.body.clubId, {
      $push: { events: event._id }
    });
    
    // Populate the event details for the response
    const populatedEvent = await Event.findById(event._id)
      .populate('clubId', 'name')
      .populate('organizer', 'name username');
    
    res.status(201).json(populatedEvent);
  } catch (error) {
    console.error('Error creating event:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update event
// @route   PUT /api/events/:id
// @access  Private
const updateEvent = async (req, res) => {
  try {
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
    
    if (!isAuthorized) {
      return res.status(403).json({ message: 'Not authorized to update this event' });
    }
    
    // Update the event
    event = await Event.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('clubId', 'name')
      .populate('organizer', 'name username');
    
    res.json(event);
  } catch (error) {
    console.error('Error updating event:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete event
// @route   DELETE /api/events/:id
// @access  Private
const deleteEvent = async (req, res) => {
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
    
    if (!isAuthorized) {
      return res.status(403).json({ message: 'Not authorized to delete this event' });
    }
    
    // Delete the event
    await Event.findByIdAndDelete(req.params.id);
    
    // Remove event from club's events array
    await Club.findByIdAndUpdate(event.clubId, {
      $pull: { events: event._id }
    });
    
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Register for an event
// @route   POST /api/events/:id/register
// @access  Private
const registerForEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Check if user is already registered
    if (event.registeredParticipants.includes(req.user._id)) {
      return res.status(400).json({ message: 'Already registered for this event' });
    }
    
    // Check if event is full
    if (event.maxParticipants && event.registeredParticipants.length >= event.maxParticipants) {
      return res.status(400).json({ message: 'Event is full' });
    }
    
    // Add user to registered participants
    event.registeredParticipants.push(req.user._id);
    await event.save();
    
    // Return updated event
    const updatedEvent = await Event.findById(req.params.id)
      .populate('clubId', 'name')
      .populate('organizer', 'name username')
      .populate('registeredParticipants', 'name username');
    
    res.json({ message: 'Registered successfully', event: updatedEvent });
  } catch (error) {
    console.error('Error registering for event:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Unregister from an event
// @route   DELETE /api/events/:id/register
// @access  Private
const unregisterFromEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Check if user is registered
    if (!event.registeredParticipants.includes(req.user._id)) {
      return res.status(400).json({ message: 'Not registered for this event' });
    }
    
    // Remove user from registered participants
    event.registeredParticipants = event.registeredParticipants.filter(
      id => id.toString() !== req.user._id.toString()
    );
    await event.save();
    
    // Return updated event
    const updatedEvent = await Event.findById(req.params.id)
      .populate('clubId', 'name')
      .populate('organizer', 'name username')
      .populate('registeredParticipants', 'name username');
    
    res.json({ message: 'Unregistered successfully', event: updatedEvent });
  } catch (error) {
    console.error('Error unregistering from event:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Debug event authorization
// @route   GET /api/events/:id/debug-auth
// @access  Private
const debugEventAuth = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Get club details
    const club = await Club.findById(event.clubId);
    
    // Check user's authorization
    const isAdmin = req.user.systemRole === 'admin';
    const isFaculty = req.user.systemRole === 'faculty';
    const isClubLeader = req.user.systemRole === 'clubLeader';
    
    let isAuthorized = isAdmin;
    let reason = 'User is admin';
    
    if (!isAuthorized && isFaculty) {
      isAuthorized = club && club.faculty && club.faculty.toString() === req.user._id.toString();
      reason = isAuthorized ? 'User is faculty monitoring this club' : 'User is faculty but not monitoring this club';
    }
    
    if (!isAuthorized && isClubLeader) {
      isAuthorized = club && club.leader && club.leader.toString() === req.user._id.toString();
      reason = isAuthorized ? 'User is club leader of this club' : 'User is club leader but not of this club';
    }
    
    if (!isAuthorized) {
      reason = 'User does not have sufficient privileges';
    }
    
    res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        systemRole: req.user.systemRole
      },
      event: {
        id: event._id,
        title: event.title,
        clubId: event.clubId
      },
      club: {
        id: club._id,
        name: club.name,
        faculty: club.faculty,
        leader: club.leader
      },
      authorization: {
        isAdmin,
        isFaculty,
        isClubLeader,
        isAuthorized,
        reason
      }
    });
  } catch (error) {
    console.error('Error in debugEventAuth:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  registerForEvent,
  unregisterFromEvent,
  debugEventAuth
};