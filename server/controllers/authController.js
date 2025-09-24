const User = require('../models/User');
const generateToken = require('../config/auth');

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  const { username, password } = req.body;

  try {
    // Check for user by username only
    const user = await User.findOne({ username }).populate('club', 'name');

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        username: user.username,
        role: user.role,
        name: user.name,
        club: user.club,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('club', 'name');

    res.json({
      _id: user._id,
      username: user.username,
      role: user.role,
      name: user.name,
      club: user.club,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  login,
  getMe,
};