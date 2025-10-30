const Club = require('../models/Club');
const User = require('../models/User');
const Event = require('../models/Event');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// @desc    Get all clubs
// @route   GET /api/clubs
// @access  Public
const getClubs = async (req, res) => {
  try {
    const clubs = await Club.find({})
      .populate('faculty', 'name username systemRole email')
      .populate('leader', 'name username systemRole email');
    
    res.json(clubs);
  } catch (error) {
    console.error('Error fetching clubs:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get clubs monitored by faculty
// @route   GET /api/clubs/faculty-monitored
// @access  Faculty
const getFacultyMonitoredClubs = async (req, res) => {
  try {
    const facultyId = req.user._id;
    
    console.log('Fetching clubs for faculty ID:', facultyId);
    
    const clubs = await Club.find({ faculty: facultyId })
      .populate('faculty', 'name username systemRole email')
      .populate('leader', 'name username systemRole email')
      .populate('events', 'title date venue status description')
      .sort({ name: 1 });
    
    console.log('Found clubs:', clubs);
    
    res.json(clubs);
  } catch (error) {
    console.error('Error fetching faculty monitored clubs:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get a club by ID
// @route   GET /api/clubs/:id
// @access  Public
const getClubById = async (req, res) => {
  try {
    let clubIdStr = req.params.id.toString();
    console.log('Fetching club with ID:', clubIdStr, '(original type:', typeof req.params.id, ')');
    
    if (!mongoose.Types.ObjectId.isValid(clubIdStr)) {
      return res.status(400).json({ message: 'Invalid club ID format' });
    }
    
    // Get club with basic populate
    let club = await Club.findById(clubIdStr)
      .populate('faculty', 'name username systemRole')
      .populate('leader', 'name username systemRole')
      .populate('events', 'title date venue status description');
    
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    // FIXED: Manual populate for members (bypass Mongoose bug for new/recent docs)
    if (club.members && club.members.length > 0) {
      const userIds = club.members.map(m => m.user).filter(id => id);
      if (userIds.length > 0) {
        const users = await User.find({ _id: { $in: userIds } }, 'name username systemRole clubRole email joinDate status').lean();
        club.members = club.members.map(member => {
          const user = users.find(u => u._id.toString() === member.user.toString());
          return {
            ...member,
            user: user || null  // Real or null for orphans
          };
        });
      }
    }
    
    console.log('Manual populated members:', club.members.map(m => ({ id: m.user?._id, name: m.user?.name })));
    
    res.json(club);
  } catch (error) {
    console.error('Error fetching club by ID:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get a club by ID with full details
// @route   GET /api/clubs/:id/full
// @access  Admin
const getClubByIdFull = async (req, res) => {
  try {
    const clubIdStr = req.params.id;
    console.log('Fetching full club with ID:', clubIdStr, 'Type:', typeof clubIdStr);

    if (!clubIdStr || typeof clubIdStr !== 'string') {
      return res.status(400).json({ message: 'Club ID must be a non-empty string' });
    }

    if (!mongoose.Types.ObjectId.isValid(clubIdStr)) {
      console.error('Invalid club ID format:', clubIdStr);
      return res.status(400).json({ message: 'Invalid club ID format (must be 24-hex chars)' });
    }

    // First get the club without population to ensure we get the raw IDs
    const club = await Club.findById(clubIdStr).lean();
    
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    // Then manually populate the related data
    let populatedClub = { ...club };

    // Populate faculty if exists
    if (club.faculty) {
      try {
        const faculty = await User.findById(club.faculty, 'name username systemRole email').lean();
        populatedClub.faculty = faculty;
      } catch (error) {
        console.error('Error populating faculty:', error);
        populatedClub.faculty = null;
      }
    }

    // Populate leader if exists
    if (club.leader) {
      try {
        const leader = await User.findById(club.leader, 'name username systemRole email').lean();
        populatedClub.leader = leader;
      } catch (error) {
        console.error('Error populating leader:', error);
        populatedClub.leader = null;
      }
    }

    // Populate members if exists
    if (club.members && club.members.length > 0) {
      try {
        const memberIds = club.members.map(m => m.user).filter(id => id);
        const users = await User.find({ _id: { $in: memberIds } }, 'name username systemRole clubRole email joinDate status').lean();
        
        populatedClub.members = club.members.map(member => {
          const user = users.find(u => u._id.toString() === member.user.toString());
          return {
            ...member,
            user: user || null
          };
        });
      } catch (error) {
        console.error('Error populating members:', error);
        populatedClub.members = club.members;
      }
    }

    // Populate events if exists
    if (club.events && club.events.length > 0) {
      try {
        const events = await Event.find({ _id: { $in: club.events } }, 'title date venue status description').lean();
        populatedClub.events = events;
      } catch (error) {
        console.error('Error populating events:', error);
        populatedClub.events = [];
      }
    }

    res.json(populatedClub);
  } catch (error) {
    console.error('Error fetching club by ID (full):', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get club members
// @route   GET /api/clubs/:id/members
// @access  Private
const getClubMembers = async (req, res) => {
  try {
    const clubIdStr = req.params.id;
    console.log('Fetching members for club ID:', clubIdStr, 'Type:', typeof clubIdStr);

    if (!clubIdStr || typeof clubIdStr !== 'string') {
      return res.status(400).json({ message: 'Club ID must be a non-empty string' });
    }

    if (!mongoose.Types.ObjectId.isValid(clubIdStr)) {
      console.error('Invalid club ID format:', clubIdStr);
      return res.status(400).json({ message: 'Invalid club ID format (must be 24-hex chars)' });
    }

    // First, get the club without population to see the raw member references
    const club = await Club.findById(clubIdStr).lean();
    
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }
    
    console.log('Raw club members array:', club.members);
    
    // FIXED: Manual populate for members
    const transformedMembers = [];
    for (const member of club.members) {
      console.log('Processing member:', member);
      
      let user = null;
      if (member.user) {
        user = await User.findById(member.user).lean();
        console.log('Found user:', user ? `ID: ${user._id}, Name: ${user.name}` : 'Not found');
      }
      
      if (user) {
        transformedMembers.push({
          _id: user._id.toString(),
          name: user.name || 'Unknown',
          username: user.username || 'N/A',
          systemRole: user.systemRole,
          clubRole: member.role,
          email: user.email,
          joinDate: member.joinDate || user.joinDate,
          status: user.status || 'active'
        });
      } else {
        // If user not found, check if it's an invalid ObjectId
        if (member.user && !mongoose.Types.ObjectId.isValid(member.user)) {
          console.log(`Invalid ObjectId in member.user: ${member.user}`);
        }
        
        transformedMembers.push({
          _id: member.user ? member.user.toString() : null,
          name: 'Unknown',
          username: 'N/A',
          clubRole: member.role,
          joinDate: member.joinDate,
          status: 'active'
        });
      }
    }
    
    console.log('Transformed members:', transformedMembers);
    res.json({ members: transformedMembers });
  } catch (error) {
    console.error('Error in getClubMembers:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Debug endpoint to check raw club data
// @route   GET /api/clubs/:id/debug
// @access  Private
const debugClubData = async (req, res) => {
  try {
    const clubIdStr = req.params.id;
    console.log('Debugging club ID:', clubIdStr, 'Type:', typeof clubIdStr);

    if (!clubIdStr || typeof clubIdStr !== 'string') {
      return res.status(400).json({ message: 'Club ID must be a non-empty string' });
    }

    if (!mongoose.Types.ObjectId.isValid(clubIdStr)) {
      console.error('Invalid club ID format:', clubIdStr);
      return res.status(400).json({ message: 'Invalid club ID format (must be 24-hex chars)' });
    }

    const club = await Club.findById(clubIdStr).lean();
    
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }
    
    // FIXED: Manual populate for debug too
    const membersWithUserData = [];
    for (const member of club.members) {
      const user = await User.findById(member.user).lean();
      membersWithUserData.push({
        member,
        user
      });
    }
    
    res.json({
      club,
      membersWithUserData
    });
  } catch (error) {
    console.error('Error in debugClubData:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Add member to club
// @route   POST /api/clubs/:id/members
// @access  Private (Club Leader)
const addClubMember = async (req, res) => {
  try {
    const clubIdStr = req.params.id;
    console.log('Adding member to club ID:', clubIdStr, 'Type:', typeof clubIdStr);

    if (!clubIdStr || typeof clubIdStr !== 'string') {
      return res.status(400).json({ message: 'Club ID must be a non-empty string' });
    }

    if (!mongoose.Types.ObjectId.isValid(clubIdStr)) {
      return res.status(400).json({ message: 'Invalid club ID format (must be 24-hex chars)' });
    }

    const club = await Club.findById(clubIdStr);
    
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }
    
    // Check if the current user is the leader of this club
    if (club.leader && club.leader.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to add members to this club' });
    }
    
    // Check if user already exists with the provided username
    const existingUser = await User.findOne({ username: req.body.username });
    
    let user;
    
    if (existingUser) {
      // If user exists, check if already a member of this club
      const isMember = club.members.some(member => 
        member.user && member.user.toString() === existingUser._id.toString()
      );
      
      if (isMember) {
        return res.status(400).json({ message: 'User is already a member of this club' });
      }
      
      user = existingUser;
    } else {
      // Create new user if doesn't exist
      user = new User({
        username: req.body.username,
        name: req.body.name,
        systemRole: 'student', // Default system role for new users
        clubRole: req.body.role || 'member', // Club-specific role
        password: 'Kmit123@', // You should implement a better way to set initial passwords
        club: club._id,
        status: 'active'  // Explicit status
      });
      
      await user.save();
      console.log('New user created with ID:', user._id);
    }
    
    // Verify the user was created/exists
    const verifiedUser = await User.findById(user._id);
    if (!verifiedUser) {
      return res.status(500).json({ message: 'Failed to create or find user' });
    }
    
    // Add user to club with their role
    club.members.push({
      user: verifiedUser._id,
      role: req.body.role || 'member',
      joinDate: new Date()
    });
    
    await club.save();
    console.log('Member added to club, saved.');
    
    // FIXED: Manual re-populate for response (force hydrate new user)
    const userIds = club.members.map(m => m.user).filter(id => id);
    const users = await User.find({ _id: { $in: userIds } }, 'name username systemRole clubRole email joinDate status').lean();
    
    const updatedMembers = club.members.map(member => {
      const user = users.find(u => u._id.toString() === member.user.toString());
      return {
        ...member,
        user: user || null
      };
    });
    
    // Transform for response
    const transformedMembers = updatedMembers.map(member => {
      if (member.user) {
        const userObj = member.user;
        return {
          _id: userObj._id.toString(),
          name: userObj.name || 'Unknown',
          username: userObj.username || 'N/A',
          systemRole: userObj.systemRole,
          clubRole: member.role,
          email: userObj.email,
          joinDate: member.joinDate || userObj.joinDate,
          status: userObj.status || 'active'
        };
      }
      return {
        _id: member.user ? member.user.toString() : null,
        name: 'Unknown',
        username: 'N/A',
        clubRole: member.role,
        joinDate: member.joinDate,
        status: 'active'
      };
    });
    
    console.log('Manual populated members in response:', transformedMembers);
    
    res.json({ 
      message: 'Member added successfully',
      members: transformedMembers 
    });
  } catch (error) {
    console.error('Error adding member to club:', error);
    
    // Handle duplicate username error
    if (error.code === 11000 && error.keyPattern && error.keyPattern.username) {
      return res.status(400).json({ message: 'Username already exists' });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Remove member from club
// @route   DELETE /api/clubs/:id/members/:memberId
// @access  Private (Club Leader)
const removeClubMember = async (req, res) => {
  try {
    const clubIdStr = req.params.id;
    const memberIdStr = req.params.memberId;
    console.log('Removing member ID:', memberIdStr, 'from club ID:', clubIdStr, 'Types:', typeof memberIdStr, typeof clubIdStr);

    if (!clubIdStr || typeof clubIdStr !== 'string') {
      return res.status(400).json({ message: 'Club ID must be a non-empty string' });
    }

    if (!mongoose.Types.ObjectId.isValid(clubIdStr)) {
      console.error('Invalid club ID format:', clubIdStr);
      return res.status(400).json({ message: 'Invalid club ID format (must be 24-hex chars)' });
    }

    if (!memberIdStr || typeof memberIdStr !== 'string') {
      return res.status(400).json({ message: 'Member ID must be a non-empty string' });
    }

    if (!mongoose.Types.ObjectId.isValid(memberIdStr)) {
      console.error('Invalid member ID format:', memberIdStr);
      return res.status(400).json({ message: 'Invalid member ID format (must be 24-hex chars)' });
    }
    
    const club = await Club.findById(clubIdStr);
    
    if (!club) {
      console.error('Club not found:', clubIdStr);
      return res.status(404).json({ message: 'Club not found' });
    }
    
    // Check if the current user is the leader of this club
    if (!club.leader) {
      console.error('Club has no leader assigned:', clubIdStr);
      return res.status(400).json({ message: 'Club has no leader assigned' });
    }
    
    if (club.leader.toString() !== req.user._id.toString()) {
      console.error('User not authorized. Current user:', req.user._id, 'Club leader:', club.leader);
      return res.status(401).json({ message: 'Not authorized to remove members from this club' });
    }
    
    // Find the member in the club's members array
    const memberIndex = club.members.findIndex(member => 
      member.user && member.user.toString() === memberIdStr.toString()
    );
    
    if (memberIndex === -1) {
      console.error('Member not found in club. Member ID:', memberIdStr, 'Club members:', 
        club.members.map(m => ({ id: m.user ? m.user.toString() : 'null', role: m.role })));
      return res.status(404).json({ 
        message: 'Member not found in this club',
        debug: {
          memberId: memberIdStr,
          clubMembers: club.members.map(m => m.user ? m.user.toString() : 'null')
        }
      });
    }
    
    // Get the member object before removing it
    const memberToRemove = club.members[memberIndex];
    console.log('Removing member:', { id: memberToRemove.user ? memberToRemove.user.toString() : 'null', role: memberToRemove.role });
    
    // Remove member from club
    club.members.splice(memberIndex, 1);
    await club.save();
    console.log('Member removed from club successfully');
    
    // Also update the user to remove club reference if this was their only club
    const user = await User.findById(memberIdStr);
    if (user) {
      console.log('Found user to update:', user._id);
      if (user.club && user.club.toString() === club._id.toString()) {
        user.club = null;
        await user.save();
        console.log('User club reference removed');
      }
    } else {
      console.warn('User not found for ID:', memberIdStr);
    }
    
    // FIXED: Manual re-populate for response
    const userIds = club.members.map(m => m.user).filter(id => id);
    const users = await User.find({ _id: { $in: userIds } }, 'name username systemRole clubRole email joinDate status').lean();
    
    const updatedMembers = club.members.map(member => {
      const user = users.find(u => u._id.toString() === member.user.toString());
      return {
        ...member,
        user: user || null
      };
    });
    
    const transformedMembers = updatedMembers.map(member => {
      if (member.user) {
        const userObj = member.user;
        return {
          _id: userObj._id.toString(),
          name: userObj.name || 'Unknown',
          username: userObj.username || 'N/A',
          systemRole: userObj.systemRole,
          clubRole: member.role,
          email: userObj.email,
          joinDate: member.joinDate || userObj.joinDate,
          status: userObj.status || 'active'
        };
      }
      return {
        _id: member.user ? member.user.toString() : null,
        name: 'Unknown',
        username: 'N/A',
        clubRole: member.role,
        joinDate: member.joinDate,
        status: 'active'
      };
    });
    
    console.log('Manual populated members after remove:', transformedMembers);
    
    res.json({ 
      message: 'Member removed successfully',
      members: transformedMembers 
    });
  } catch (error) {
    console.error('Error removing member from club:', error);
    res.status(500).json({ 
      message: 'Server Error', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Update a club member
// @route   PUT /api/clubs/:id/members/:memberId
// @access  Private (Club Leader)
const updateClubMember = async (req, res) => {
  try {
    const clubIdStr = req.params.id;
    const memberIdStr = req.params.memberId;
    console.log('Updating member ID:', memberIdStr, 'in club ID:', clubIdStr, 'Types:', typeof memberIdStr, typeof clubIdStr);

    if (!clubIdStr || typeof clubIdStr !== 'string') {
      return res.status(400).json({ message: 'Club ID must be a non-empty string' });
    }

    if (!mongoose.Types.ObjectId.isValid(clubIdStr)) {
      console.error('Invalid club ID format:', clubIdStr);
      return res.status(400).json({ message: 'Invalid club ID format (must be 24-hex chars)' });
    }

    if (!memberIdStr || typeof memberIdStr !== 'string') {
      return res.status(400).json({ message: 'Member ID must be a non-empty string' });
    }

    if (!mongoose.Types.ObjectId.isValid(memberIdStr)) {
      console.error('Invalid member ID format:', memberIdStr);
      return res.status(400).json({ message: 'Invalid member ID format (must be 24-hex chars)' });
    }

    const club = await Club.findById(clubIdStr);
    
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }
    
    // Check if the current user is the leader of this club
    if (club.leader && club.leader.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to update members in this club' });
    }
    
    // Find the member in the club's members array
    const member = club.members.find(m => 
      m.user && m.user.toString() === memberIdStr.toString()
    );
    
    if (!member) {
      return res.status(404).json({ message: 'Member not found in this club' });
    }
    
    // Update the member's role and status in the club
    if (req.body.role) {
      member.role = req.body.role;
    }
    
    // Also update the user's name and username if provided
    if (req.body.name || req.body.username) {
      const user = await User.findById(memberIdStr);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      if (req.body.name) {
        user.name = req.body.name;
      }
      
      if (req.body.username) {
        // Check if username is already taken by another user
        const existingUser = await User.findOne({ 
          username: req.body.username,
          _id: { $ne: memberIdStr }
        });
        
        if (existingUser) {
          return res.status(400).json({ message: 'Username already taken' });
        }
        
        user.username = req.body.username;
      }
      
      if (req.body.status) {
        user.status = req.body.status;
      }
      
      await user.save();
    }
    
    // Save the club
    await club.save();
    
    // FIXED: Manual re-populate for response
    const userIds = club.members.map(m => m.user).filter(id => id);
    const users = await User.find({ _id: { $in: userIds } }, 'name username systemRole clubRole email joinDate status').lean();
    
    const updatedMembers = club.members.map(member => {
      const user = users.find(u => u._id.toString() === member.user.toString());
      return {
        ...member,
        user: user || null
      };
    });
    
    const transformedMembers = updatedMembers.map(member => {
      if (member.user) {
        const userObj = member.user;
        return {
          _id: userObj._id.toString(),
          name: userObj.name || 'Unknown',
          username: userObj.username || 'N/A',
          systemRole: userObj.systemRole,
          clubRole: member.role,
          email: userObj.email,
          joinDate: member.joinDate || userObj.joinDate,
          status: userObj.status || 'active'
        };
      }
      return {
        _id: member.user ? member.user.toString() : null,
        name: 'Unknown',
        username: 'N/A',
        clubRole: member.role,
        joinDate: member.joinDate,
        status: 'active'
      };
    });
    
    res.json({ 
      message: 'Member updated successfully',
      members: transformedMembers 
    });
  } catch (error) {
    console.error('Error updating club member:', error);
    
    // Handle duplicate username error
    if (error.code === 11000 && error.keyPattern && error.keyPattern.username) {
      return res.status(400).json({ message: 'Username already taken' });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a club
// @route   POST /api/clubs
// @access  Admin
const createClub = async (req, res) => {
  const { 
    name, 
    description, 
    faculty,   
    leader     
  } = req.body;

  try {
    // Check if club exists
    const clubExists = await Club.findOne({ name });

    if (clubExists) {
      return res.status(400).json({ message: 'Club already exists' });
    }

    // Validate that faculty is provided
    if (!faculty) {
      return res.status(400).json({ message: 'Faculty coordinator is required' });
    }

    // If faculty is provided, check if they exist and have faculty role
    const facultyUser = await User.findById(faculty);
    
    if (!facultyUser) {
      return res.status(404).json({ message: 'Faculty not found' });
    }
    
    if (facultyUser.systemRole !== 'faculty') {
      return res.status(400).json({ message: 'Assigned user is not a faculty member' });
    }

    // Create club with required fields
    const clubData = {
      name,
      description,
      faculty,
      leader: leader || null
    };

    // Create the club
    const club = await Club.create(clubData);

    // Update faculty with club reference
    await User.findByIdAndUpdate(faculty, { 
      club: club._id 
    });

    // Update leader with club reference if leader was provided
    if (leader) {
      // If leader is provided, check if they exist and have club leader role
      const leaderUser = await User.findById(leader);
      
      if (!leaderUser) {
        return res.status(404).json({ message: 'Club leader not found' });
      }
      
      if (leaderUser.systemRole !== 'clubLeader') {
        return res.status(400).json({ message: 'Assigned user is not a club leader' });
      }
      
      await User.findByIdAndUpdate(leader, { 
        club: club._id 
      });
    }

    // FIXED: Manual populate for response
    const populatedClub = await Club.findById(club._id)
      .populate('faculty', 'name username systemRole email')
      .populate('leader', 'name username systemRole email');

    res.status(201).json(populatedClub);
  } catch (error) {
    console.error('Error creating club:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update a club
// @route   PUT /api/clubs/:id
// @access  Admin
const updateClub = async (req, res) => {
  let { 
    name, 
    description, 
    faculty, 
    leader,
    status 
  } = req.body;

  try {
    const clubIdStr = req.params.id;
    console.log('Updating club ID:', clubIdStr, 'Type:', typeof clubIdStr);

    if (!clubIdStr || typeof clubIdStr !== 'string') {
      return res.status(400).json({ message: 'Club ID must be a non-empty string' });
    }

    if (!mongoose.Types.ObjectId.isValid(clubIdStr)) {
      console.error('Invalid club ID format:', clubIdStr);
      return res.status(400).json({ message: 'Invalid club ID format (must be 24-hex chars)' });
    }

    const club = await Club.findById(clubIdStr);

    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    // Store the old faculty and leader for later comparison
    const oldFaculty = club.faculty;
    const oldLeader = club.leader;

    // If faculty is provided, check if they exist and have faculty role
    if (faculty) {
      const facultyUser = await User.findById(faculty);
      
      if (!facultyUser) {
        return res.status(404).json({ message: 'Faculty not found' });
      }
      
      if (facultyUser.systemRole !== 'faculty') {
        return res.status(400).json({ message: 'Assigned user is not a faculty member' });
      }
    } else {
      // If faculty is not provided, keep the existing one
      faculty = club.faculty;
    }

    // If leader is provided, check if they exist and have club leader role
    if (leader !== undefined) {  // Changed to !== undefined to handle explicit null
      const leaderUser = await User.findById(leader);
      
      if (leader && !leaderUser) {
        return res.status(404).json({ message: 'Club leader not found' });
      }
      
      if (leader && leaderUser.systemRole !== 'clubLeader') {
        return res.status(400).json({ message: 'Assigned user is not a club leader' });
      }
    } else {
      // If leader is not provided, keep the existing one
      leader = club.leader;
    }

    // Update club fields
    club.name = name || club.name;
    club.description = description || club.description;
    club.faculty = faculty;
    club.leader = leader;
    club.status = status || club.status;

    const updatedClub = await club.save();

    // Update faculty references (safe null handling)
    if (oldFaculty && (!faculty || oldFaculty.toString() !== faculty.toString())) {
      // Remove club reference from old faculty
      await User.findByIdAndUpdate(oldFaculty, { 
        club: null 
      });
    }

    if (faculty && (!oldFaculty || oldFaculty.toString() !== faculty.toString())) {
      // Add club reference to new faculty
      await User.findByIdAndUpdate(faculty, { 
        club: updatedClub._id 
      });
    }

    // Update leader references (safe null handling)
    if (oldLeader && (!leader || oldLeader.toString() !== leader.toString())) {
      // Remove club reference from old leader
      await User.findByIdAndUpdate(oldLeader, { 
        club: null 
      });
    }

    if (leader && (!oldLeader || oldLeader.toString() !== leader.toString())) {
      // Add club reference to new leader
      await User.findByIdAndUpdate(leader, { 
        club: updatedClub._id 
      });
    }

    // FIXED: Manual populate for response
    const populatedClub = await Club.findById(updatedClub._id)
      .populate('faculty', 'name username systemRole email')
      .populate('leader', 'name username systemRole email');

    res.json(populatedClub);
  } catch (error) {
    console.error('Error updating club:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete a club
// @route   DELETE /api/clubs/:id
// @access  Admin
const deleteClub = async (req, res) => {
  try {
    const clubIdStr = req.params.id;
    console.log('Deleting club ID:', clubIdStr, 'Type:', typeof clubIdStr);

    if (!clubIdStr || typeof clubIdStr !== 'string') {
      return res.status(400).json({ message: 'Club ID must be a non-empty string' });
    }

    if (!mongoose.Types.ObjectId.isValid(clubIdStr)) {
      console.error('Invalid club ID format:', clubIdStr);
      return res.status(400).json({ message: 'Invalid club ID format (must be 24-hex chars)' });
    }

    const club = await Club.findById(clubIdStr);

    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    // Remove club reference from faculty
    if (club.faculty) {
      await User.findByIdAndUpdate(club.faculty, { 
        club: null 
      });
    }

    // Remove club reference from leader
    if (club.leader) {
      await User.findByIdAndUpdate(club.leader, { 
        club: null 
      });
    }

    // Remove club reference from all members
    if (club.members && club.members.length > 0) {
      await User.updateMany(
        { _id: { $in: club.members.map(m => m.user) } },
        { club: null }
      );
    }

    // Delete all events associated with this club
    await Event.deleteMany({ club: club._id });

    // Use deleteOne() instead of remove()
    await Club.deleteOne({ _id: club._id });

    res.json({ message: 'Club removed' });
  } catch (error) {
    console.error('Error deleting club:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Assign faculty to a club
// @route   PUT /api/clubs/:id/assign-faculty
// @access  Admin
const assignFaculty = async (req, res) => {
  const { facultyId } = req.body;

  try {
    const clubIdStr = req.params.id;
    console.log('Assigning faculty:', facultyId, 'to club:', clubIdStr, 'Type:', typeof clubIdStr);

    if (!clubIdStr || typeof clubIdStr !== 'string') {
      return res.status(400).json({ message: 'Club ID must be a non-empty string' });
    }

    if (!mongoose.Types.ObjectId.isValid(clubIdStr)) {
      console.error('Invalid club ID format:', clubIdStr);
      return res.status(400).json({ message: 'Invalid club ID format (must be 24-hex chars)' });
    }

    const club = await Club.findById(clubIdStr);

    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    const faculty = await User.findById(facultyId);

    if (!faculty) {
      return res.status(404).json({ message: 'Faculty not found' });
    }

    if (faculty.systemRole !== 'faculty') {
      return res.status(400).json({ message: 'Assigned user is not a faculty member' });
    }

    // Remove club reference from previous faculty if exists
    if (club.faculty) {
      console.log('Removing club reference from previous faculty:', club.faculty);
      await User.findByIdAndUpdate(club.faculty, { 
        club: null 
      });
    }

    club.faculty = faculty._id;
    await club.save();
    console.log('Club saved with faculty:', club.faculty);

    // Update new faculty with club reference
    await User.findByIdAndUpdate(faculty._id, { 
      club: club._id 
    });
    console.log('Faculty updated with club reference');

    // FIXED: Manual populate for response
    const populatedClub = await Club.findById(club._id)
      .populate('faculty', 'name username systemRole email')
      .populate('leader', 'name username systemRole email')
      .populate({
        path: 'members.user',
        select: 'name username systemRole clubRole email joinDate status'
      })
      .populate({
        path: 'events',
        select: 'title date venue status description'
      });

    console.log('Populated club to return:', populatedClub);
    res.json(populatedClub);
  } catch (error) {
    console.error('Error assigning faculty:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Assign leader to a club
// @route   PUT /api/clubs/:id/assign-leader
// @access  Admin
const assignLeader = async (req, res) => {
  const { leaderId } = req.body;

  try {
    const clubIdStr = req.params.id;
    console.log('Assigning leader:', leaderId, 'to club:', clubIdStr, 'Type:', typeof clubIdStr);

    if (!clubIdStr || typeof clubIdStr !== 'string') {
      return res.status(400).json({ message: 'Club ID must be a non-empty string' });
    }

    if (!mongoose.Types.ObjectId.isValid(clubIdStr)) {
      console.error('Invalid club ID format:', clubIdStr);
      return res.status(400).json({ message: 'Invalid club ID format (must be 24-hex chars)' });
    }

    const club = await Club.findById(clubIdStr);

    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    const leader = await User.findById(leaderId);

    if (!leader) {
      return res.status(404).json({ message: 'Leader not found' });
    }

    if (leader.systemRole !== 'clubLeader') {
      return res.status(400).json({ message: 'Assigned user is not a club leader' });
    }

    // Remove club reference from previous leader if exists
    if (club.leader) {
      console.log('Removing club reference from previous leader:', club.leader);
      await User.findByIdAndUpdate(club.leader, { 
        club: null 
      });
    }

    club.leader = leader._id;
    await club.save();
    console.log('Club saved with leader:', club.leader);

    // Update new leader with club reference
    await User.findByIdAndUpdate(leader._id, { 
      club: club._id 
    });
    console.log('Leader updated with club reference');

    // FIXED: Manual populate for response
    const populatedClub = await Club.findById(club._id)
      .populate('faculty', 'name username systemRole email')
      .populate('leader', 'name username systemRole email')
      .populate({
        path: 'members.user',
        select: 'name username systemRole clubRole email joinDate status'
      })
      .populate({
        path: 'events',
        select: 'title date venue status description'
      });

    console.log('Populated club to return:', populatedClub);
    res.json(populatedClub);
  } catch (error) {
    console.error('Error assigning leader:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Remove faculty from a club
// @route   PUT /api/clubs/:id/remove-faculty
// @access  Admin
const removeFaculty = async (req, res) => {
  try {
    const clubIdStr = req.params.id;
    console.log('Removing faculty from club ID:', clubIdStr, 'Type:', typeof clubIdStr);

    if (!clubIdStr || typeof clubIdStr !== 'string') {
      return res.status(400).json({ message: 'Club ID must be a non-empty string' });
    }

    if (!mongoose.Types.ObjectId.isValid(clubIdStr)) {
      console.error('Invalid club ID format:', clubIdStr);
      return res.status(400).json({ message: 'Invalid club ID format (must be 24-hex chars)' });
    }

    const club = await Club.findById(clubIdStr);

    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    // Remove club reference from faculty
    if (club.faculty) {
      await User.findByIdAndUpdate(club.faculty, { 
        club: null 
      });
    }

    club.faculty = null;
    await club.save();

    // FIXED: Manual populate for response
    const populatedClub = await Club.findById(club._id)
      .populate('faculty', 'name username systemRole')
      .populate('leader', 'name username systemRole');

    res.json(populatedClub);
  } catch (error) {
    console.error('Error removing faculty:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Remove leader from a club
// @route   PUT /api/clubs/:id/remove-leader
// @access  Admin
const removeLeader = async (req, res) => {
  try {
    const clubIdStr = req.params.id;
    console.log('Removing leader from club ID:', clubIdStr, 'Type:', typeof clubIdStr);

    if (!clubIdStr || typeof clubIdStr !== 'string') {
      return res.status(400).json({ message: 'Club ID must be a non-empty string' });
    }

    if (!mongoose.Types.ObjectId.isValid(clubIdStr)) {
      console.error('Invalid club ID format:', clubIdStr);
      return res.status(400).json({ message: 'Invalid club ID format (must be 24-hex chars)' });
    }

    const club = await Club.findById(clubIdStr);

    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    // Remove club reference from leader
    if (club.leader) {
      await User.findByIdAndUpdate(club.leader, { 
        club: null 
      });
    }

    club.leader = null;
    await club.save();

    // FIXED: Manual populate for response
    const populatedClub = await Club.findById(club._id)
      .populate('faculty', 'name username systemRole')
      .populate('leader', 'name username systemRole');

    res.json(populatedClub);
  } catch (error) {
    console.error('Error removing leader:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Clean up invalid member references in all clubs
// @route   POST /api/clubs/cleanup-members
// @access  Admin
const cleanupInvalidMembers = async (req, res) => {
  try {
    console.log('Starting cleanup of invalid member references...');
    
    const clubs = await Club.find({});
    let totalCleaned = 0;
    
    for (const club of clubs) {
      const validMembers = [];
      let cleanedCount = 0;
      
      for (const member of club.members) {
        // Check if the user exists
        const user = await User.findById(member.user);
        if (user) {
          validMembers.push(member);
        } else {
          cleanedCount++;
          console.log(`Removing invalid member reference: ${member.user} from club: ${club.name}`);
        }
      }
      
      if (cleanedCount > 0) {
        club.members = validMembers;
        await club.save();
        totalCleaned += cleanedCount;
        console.log(`Cleaned ${cleanedCount} invalid members from club: ${club.name}`);
      }
    }
    
    res.json({ 
      message: 'Cleanup completed',
      totalClubsProcessed: clubs.length,
      totalInvalidMembersRemoved: totalCleaned
    });
  } catch (error) {
    console.error('Error cleaning up invalid members:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update club settings (for club leaders)
// @route   PUT /api/clubs/:id/settings
// @access  Private (Club Leader)
const updateClubSettings = async (req, res) => {
    try {
        const clubIdStr = req.params.id;
        console.log('Updating club settings for ID:', clubIdStr, 'Type:', typeof clubIdStr);

        if (!clubIdStr || typeof clubIdStr !== 'string') {
          return res.status(400).json({ message: 'Club ID must be a non-empty string' });
        }

        if (!mongoose.Types.ObjectId.isValid(clubIdStr)) {
          console.error('Invalid club ID format:', clubIdStr);
          return res.status(400).json({ message: 'Invalid club ID format (must be 24-hex chars)' });
        }
        
        const club = await Club.findById(clubIdStr);
        
        if (!club) {
            return res.status(404).json({ message: 'Club not found' });
        }
        
        // Check if user is the leader of this club
        if (club.leader.toString() !== req.user.id && req.user.systemRole !== 'admin') {
            return res.status(403).json({ message: 'Not authorized to update this club' });
        }
        
        const { name, description, category, registerLink, removeBanner } = req.body;
        
        // Update club details
        club.name = name || club.name;
        club.description = description || club.description;
        club.type = category || club.type;
        club.registerLink = registerLink || club.registerLink;
        
        // Handle banner image
        if (req.file) {
            // If there's an existing banner image, remove it
            if (club.bannerImage) {
                const imagePath = path.join(__dirname, '../public', club.bannerImage);
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            }
            
            // Set new banner image path
            club.bannerImage = `/uploads/clubs/${req.file.filename}`;
        } else if (removeBanner === 'true') {
            // Remove banner image if requested
            if (club.bannerImage) {
                const imagePath = path.join(__dirname, '../public', club.bannerImage);
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
                club.bannerImage = null;
            }
        }
        
        await club.save();
        
        // FIXED: Manual populate for response
        const populatedClub = await Club.findById(club._id)
            .populate('faculty', 'name username email')
            .populate('leader', 'name username email')
            .populate({
              path: 'members.user',
              select: 'name username systemRole clubRole email joinDate status'
            });
        
        res.json(populatedClub);
    } catch (error) {
        console.error('Error updating club settings:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
  getClubs,
  getFacultyMonitoredClubs,
  getClubById,
  getClubByIdFull,
  getClubMembers,
  debugClubData,
  addClubMember,
  removeClubMember,
  updateClubMember,
  createClub,
  updateClub,
  deleteClub,
  assignFaculty,
  assignLeader,
  removeFaculty,
  removeLeader,
  cleanupInvalidMembers,
  updateClubSettings,
};