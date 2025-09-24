const express = require('express');
const Event = require('../models/Event');
const Club = require('../models/Club');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { getRedisClient } = require('../config/redis');

const router = express.Router();

// Get all events
router.get('/', async (req, res) => {
  try {
    const { status, clubId, upcoming } = req.query;
    let query = {};

    if (status) {
      query.status = status;
    }

    if (clubId) {
      query.clubId = clubId;
    }

    if (upcoming === 'true') {
      query.date = { $gte: new Date() };
    }

    const events = await Event.find(query)
      .populate('clubId', 'name category')
      .populate('organizer', 'name')
      .sort({ date: upcoming === 'true' ? 1 : -1 });

    res.json(events);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ message: 'Failed to fetch events' });
  }
});

// Get event by ID
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('clubId', 'name category')
      .populate('organizer', 'name email')
      .populate('registeredParticipants.userId', 'name email')
      .populate('approvedBy', 'name');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ message: 'Failed to fetch event' });
  }
});

// Create new event
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      clubId,
      eventType,
      venue,
      date,
      startTime,
      endTime,
      maxParticipants,
      budget
    } = req.body;

    // Check if user has permission to create events for this club
    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    const userMembership = club.members.find(
      member => member.userId.toString() === req.user._id.toString()
    );

    if (!userMembership || userMembership.status !== 'active') {
      if (req.user.role !== 'faculty' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Not a member of this club' });
      }
    }

    const event = new Event({
      title,
      description,
      clubId,
      organizer: req.user._id,
      eventType,
      venue,
      date,
      startTime,
      endTime,
      maxParticipants: maxParticipants || 0,
      budget: {
        requested: budget || 0
      }
    });

    await event.save();

    // Add event to club
    club.events.push(event._id);
    await club.save();

    // Notify via Redis
    const redis = getRedisClient();
    await redis.publish('event-updates', JSON.stringify({
      type: 'event-created',
      eventId: event._id,
      clubId,
      title: event.title,
      organizer: req.user.name,
      timestamp: new Date()
    }));

    res.status(201).json({
      message: 'Event created successfully',
      event
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ message: 'Failed to create event' });
  }
});

// Register for event
router.post('/:id/register', authenticateToken, async (req, res) => {
  try {
    const eventId = req.params.id;
    const userId = req.user._id;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if already registered
    const existingRegistration = event.registeredParticipants.find(
      participant => participant.userId.toString() === userId.toString()
    );

    if (existingRegistration) {
      return res.status(400).json({ message: 'Already registered for this event' });
    }

    // Check capacity
    if (event.maxParticipants > 0 && 
        event.registeredParticipants.length >= event.maxParticipants) {
      return res.status(400).json({ message: 'Event is full' });
    }

    // Register user
    event.registeredParticipants.push({ userId });
    await event.save();

    res.json({ message: 'Successfully registered for event' });
  } catch (error) {
    console.error('Event registration error:', error);
    res.status(500).json({ message: 'Failed to register for event' });
  }
});

// Approve event (faculty/admin only)
router.patch('/:id/approve', 
  authenticateToken, 
  requireRole(['faculty', 'admin']), 
  async (req, res) => {
    try {
      const { approvalNotes, approvedBudget } = req.body;

      const event = await Event.findByIdAndUpdate(
        req.params.id,
        {
          status: 'approved',
          approvedBy: req.user._id,
          approvalNotes,
          'budget.approved': approvedBudget || 0
        },
        { new: true }
      ).populate('clubId', 'name')
       .populate('organizer', 'name');

      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      // Notify via Redis
      const redis = getRedisClient();
      await redis.publish('event-updates', JSON.stringify({
        type: 'event-approved',
        eventId: event._id,
        title: event.title,
        clubName: event.clubId.name,
        approvedBy: req.user.name,
        timestamp: new Date()
      }));

      res.json({
        message: 'Event approved successfully',
        event
      });
    } catch (error) {
      console.error('Approve event error:', error);
      res.status(500).json({ message: 'Failed to approve event' });
    }
  }
);

module.exports = router;