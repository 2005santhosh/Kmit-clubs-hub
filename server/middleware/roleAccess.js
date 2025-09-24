const User = require('../models/User');
const Club = require('../models/Club');
const { protect } = require('./auth');
// Middleware to check if user can create users of a specific role
const canCreateRole = (targetRole) => {
  return async (req, res, next) => {
    try {
      const userRole = req.user.role;
      
      // Define role hierarchy
      const roleHierarchy = {
        'admin': ['faculty'],
        'faculty': ['clubLeader'],
        'clubLeader': ['student']
      };
      
      // Check if user can create the target role
      if (!roleHierarchy[userRole] || !roleHierarchy[userRole].includes(targetRole)) {
        return res.status(403).json({ 
          message: `You are not authorized to create ${targetRole} accounts` 
        });
      }
      
      // For faculty creating club leaders, check if they are assigned to a club
      if (userRole === 'faculty' && targetRole === 'clubLeader') {
        const club = await Club.findOne({ facultyCoordinator: req.user._id });
        if (!club) {
          return res.status(403).json({ 
            message: 'You must be assigned to a club to create club leaders' 
          });
        }
        req.club = club; // Attach club to request for use in controller
      }
      
      // For club leaders creating students, check if they belong to a club
      if (userRole === 'clubLeader' && targetRole === 'student') {
        if (!req.user.club) {
          return res.status(403).json({ 
            message: 'You must belong to a club to create students' 
          });
        }
        req.club = await Club.findById(req.user.club);
      }
      
      next();
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server Error' });
    }
  };
};

// Middleware to check if user can perform actions on a specific club
const canManageClub = async (req, res, next) => {
  try {
    const clubId = req.params.id || req.body.clubId;
    const userRole = req.user.role;
    
    // Admin can manage any club
    if (userRole === 'admin') {
      return next();
    }
    
    // Faculty can only manage clubs they coordinate
    if (userRole === 'faculty') {
      const club = await Club.findOne({ _id: clubId, facultyCoordinator: req.user._id });
      if (!club) {
        return res.status(403).json({ 
          message: 'You are not authorized to manage this club' 
        });
      }
      req.club = club;
      return next();
    }
    
    // Club leaders can only manage their own club
    if (userRole === 'clubLeader') {
      if (!req.user.club || req.user.club.toString() !== clubId) {
        return res.status(403).json({ 
          message: 'You are not authorized to manage this club' 
        });
      }
      req.club = await Club.findById(clubId);
      return next();
    }
    
    // Students cannot manage clubs
    return res.status(403).json({ 
      message: 'You are not authorized to manage clubs' 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Middleware to check if user can view club information
const canViewClub = async (req, res, next) => {
  try {
    const clubId = req.params.id;
    const userRole = req.user.role;
    
    // Admin, faculty, and club leaders can view any club
    if (['admin', 'faculty', 'clubLeader'].includes(userRole)) {
      return next();
    }
    
    // Students can only view their own club
    if (userRole === 'student') {
      if (!req.user.club || req.user.club.toString() !== clubId) {
        return res.status(403).json({ 
          message: 'You are not authorized to view this club' 
        });
      }
      return next();
    }
    
    // Unauthenticated users cannot view clubs
    return res.status(401).json({ 
      message: 'Authentication required to view club details' 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  canCreateRole,
  canManageClub,
  canViewClub
};