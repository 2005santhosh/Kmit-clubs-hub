const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Club = require('../models/Club'); // Add this line to import the Club model

// @desc    Send notification to users
// @route   POST /api/notifications
// @access  Private (Admin)
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { title, message, recipients } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required' });
    }
    
    if (!recipients || recipients.length === 0) {
      return res.status(400).json({ message: 'At least one recipient must be selected' });
    }
    
    // Get users based on recipient selection
    let recipientUsers = [];
    let isGlobal = false;
    
    if (recipients.includes('all')) {
      // Get all users
      recipientUsers = await User.find({});
      isGlobal = true;
    } else {
      // Get users by selected roles
      const roles = recipients.filter(r => r !== 'all');
      recipientUsers = await User.find({ role: { $in: roles } });
    }
    
    if (recipientUsers.length === 0) {
      return res.status(404).json({ message: 'No users found for the selected recipients' });
    }
    
    // Create notification object
    const notificationData = {
      title,
      message,
      sender: req.user._id,
      isGlobal,
      recipients: recipientUsers.map(user => user._id)
    };
    
    // Create the notification
    const notification = new Notification(notificationData);
    await notification.save();
    
    // In a real application, you would also send real-time notifications
    // via WebSockets, push notifications, etc.
    console.log(`Notification "${title}" sent to ${recipientUsers.length} users`);
    console.log(`Message: ${message}`);
    
    res.status(200).json({ 
      message: 'Notification sent successfully',
      recipientsCount: recipientUsers.length,
      notificationId: notification._id
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @desc    Get notifications for the current user
// @route   GET /api/notifications
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    // Find notifications that are either global or specifically for this user
    const notifications = await Notification.find({
      $or: [
        { isGlobal: true },
        { recipients: req.user._id }
      ]
    })
    .populate('sender', 'name')
    .sort({ createdAt: -1 })
    .limit(20);
    
    // Format notifications for frontend
    const formattedNotifications = notifications.map(notification => {
      const isRead = notification.readBy.some(read => 
        read.user.toString() === req.user._id.toString()
      );
      
      return {
        _id: notification._id,
        title: notification.title,
        message: notification.message,
        sender: notification.sender ? notification.sender.name : 'Unknown Sender',
        time: notification.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: notification.createdAt.toLocaleDateString(),
        isRead,
        createdAt: notification.createdAt
      };
    });
    
    res.json(formattedNotifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
router.get('/unread-count', protect, async (req, res) => {
  try {
    // Count notifications that are either global or specifically for this user
    // and haven't been read by this user
    const unreadCount = await Notification.countDocuments({
      $or: [
        { isGlobal: true },
        { recipients: req.user._id }
      ],
      readBy: { $not: { $elemMatch: { user: req.user._id } } }
    });
    
    res.json({ count: unreadCount });
  } catch (error) {
    console.error('Error fetching unread notification count:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @desc    Mark a notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
router.put('/:id/read', protect, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    // Check if user is authorized to read this notification
    const isRecipient = notification.isGlobal || 
      notification.recipients.some(recipient => 
        recipient.toString() === req.user._id.toString()
      );
    
    if (!isRecipient) {
      return res.status(403).json({ message: 'Not authorized to read this notification' });
    }
    
    // Check if already read
    const alreadyRead = notification.readBy.some(read => 
      read.user.toString() === req.user._id.toString()
    );
    
    if (!alreadyRead) {
      notification.readBy.push({
        user: req.user._id,
        readAt: new Date()
      });
      
      // Also set isRead to true for compatibility
      notification.isRead = true;
      
      await notification.save();
    }
    
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/mark-all-read
// @access  Private
router.put('/mark-all-read', protect, async (req, res) => {
  try {
    // Get all unread notifications for this user
    const unreadNotifications = await Notification.find({
      $or: [
        { isGlobal: true },
        { recipients: req.user._id }
      ],
      readBy: { $not: { $elemMatch: { user: req.user._id } } }
    });
    
    // Mark all as read
    await Promise.all(unreadNotifications.map(notification => {
      notification.readBy.push({
        user: req.user._id,
        readAt: new Date()
      });
      notification.isRead = true; // Also set isRead to true
      return notification.save();
    }));
    
    res.json({ 
      message: 'All notifications marked as read',
      count: unreadNotifications.length
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @desc    Delete a notification
// @route   DELETE /api/notifications/:id
// @access  Private (Admin)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    await notification.remove();
    
    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @desc    Send notification to club members
// @route   POST /api/notifications/send-to-club
// @access  Private (Club Leader)
router.post('/send-to-club', protect, authorize('clubLeader'), async (req, res) => {
  try {
    const { clubId, title, message } = req.body;
    
    if (!clubId || !title || !message) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }
    
    // Get club and verify user is leader
    const club = await Club.findById(clubId).populate('members', '_id name email role');
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }
    
    if (club.leader.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to send notifications for this club' });
    }
    
    // Get all club members (no filtering - send to everyone in members array)
    const clubMembers = club.members;
    
    if (clubMembers.length === 0) {
      return res.status(404).json({ message: 'No club members found in this club' });
    }
    
    // Create notification with all club members as recipients
    const notification = new Notification({
      title,
      message,
      sender: req.user._id,
      recipients: clubMembers.map(member => member._id),
      isGlobal: false
    });
    
    await notification.save();
    
    console.log(`Notification "${title}" sent to ${clubMembers.length} club members of club "${club.name}"`);
    
    res.json({ 
      success: true, 
      message: `Notification sent successfully to ${clubMembers.length} club members`,
      recipientsCount: clubMembers.length
    });
  } catch (err) {
    console.error('Error sending notification to club:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;