const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];
            console.log('Token received:', token);

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
            console.log('Token decoded:', decoded);

            // Get user from the token
            req.user = await User.findById(decoded.id).select('-password');
            
            if (!req.user) {
                console.log('User not found for ID:', decoded.id);
                return res.status(401).json({ message: 'User not found' });
            }
            
            // Check if user is active
            if (req.user.status !== 'active') {
                console.log('User account is inactive:', req.user.username);
                return res.status(401).json({ message: 'Your account is inactive. Please contact your club administrator.' });
            }
            
            console.log('User authenticated:', req.user.username, 'Role:', req.user.systemRole || req.user.role);
            next();
        } catch (error) {
            console.error('Token verification error:', error);
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        console.log('No token provided');
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

// Middleware to check if user is an admin
const admin = (req, res, next) => {
    // Check both systemRole and role for compatibility
    const userRole = req.user.systemRole || req.user.role;
    console.log('Admin check for user:', req.user.username, 'Role:', userRole);
    if (userRole === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized as an admin' });
    }
};

// Middleware to check if user is a faculty member
const faculty = (req, res, next) => {
    // Check both systemRole and role for compatibility
    const userRole = req.user.systemRole || req.user.role;
    console.log('Faculty check for user:', req.user.username, 'Role:', userRole);
    if (userRole === 'faculty') {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized as a faculty member' });
    }
};

// Middleware to check if user is a club leader
const clubLeader = (req, res, next) => {
    // Check both systemRole and role for compatibility
    const userRole = req.user.systemRole || req.user.role;
    console.log('Club leader check for user:', req.user.username, 'Role:', userRole);
    if (userRole === 'clubLeader') {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized as a club leader' });
    }
};

// Middleware to check if user is a student
const student = (req, res, next) => {
    // Check both systemRole and role for compatibility
    const userRole = req.user.systemRole || req.user.role;
    console.log('Student check for user:', req.user.username, 'Role:', userRole);
    if (userRole === 'student') {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized as a student' });
    }
};

// Grant access to specific roles
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authorized, no user' });
        }
        
        // Check both systemRole and role for compatibility
        const userRole = req.user.systemRole || req.user.role;
        
        // Handle comma-separated roles (e.g., 'admin,faculty') or array of roles
        let requiredRoles = [];
        roles.forEach(roleArg => {
            if (typeof roleArg === 'string' && roleArg.includes(',')) {
                // Split comma-separated string
                requiredRoles = requiredRoles.concat(roleArg.split(',').map(r => r.trim()));
            } else {
                // Single role
                requiredRoles.push(roleArg);
            }
        });
        
        console.log('Authorization check for user:', req.user.username, 'Role:', userRole, 'Required roles:', requiredRoles);
        
        if (!requiredRoles.includes(userRole)) {
            return res.status(403).json({ 
                message: `User role ${userRole} is not authorized to access this route` 
            });
        }
        
        next();
    };
};

// Combined middleware function that runs protect and then admin
const adminAuth = (req, res, next) => {
    protect(req, res, (err) => {
        if (err) return next(err);
        admin(req, res, next);
    });
};

module.exports = { 
    protect, 
    admin, 
    faculty, 
    clubLeader, 
    student, 
    authorize, 
    adminAuth 
};