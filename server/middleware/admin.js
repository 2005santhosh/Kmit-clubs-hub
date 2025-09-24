const { protect } = require('./auth');

// Middleware to check if user is an admin
const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};

// Combined middleware function that runs protect and then admin
const adminAuth = (req, res, next) => {
  protect(req, res, (err) => {
    if (err) return next(err);
    admin(req, res, next);
  });
};

module.exports = adminAuth;