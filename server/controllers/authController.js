const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Helper function to generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'your_jwt_secret', {
    expiresIn: '5h',
  });
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log(`Login attempt for username: ${username}`);
    console.log(`Password length: ${password ? password.length : 0}`);
    
    // Find user by username
    const user = await User.findOne({ username });
    
    if (!user) {
      console.log(`User not found: ${username}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Check if user is active
    if (user.status !== 'active') {
      console.log(`User account is inactive: ${username}`);
      return res.status(401).json({ message: 'Your account is inactive. Please contact your club administrator.' });
    }
    
    console.log(`User found: ${username}, role: ${user.systemRole}`);
    console.log(`Stored password hash: ${user.password.substring(0, 20)}...`);
    
    // Trim the password to remove any whitespace
    const trimmedPassword = password.trim();
    console.log('Password after trim:', trimmedPassword);
    
    // Test password comparison using the User model's matchPassword method
    try {
      const isMatch = await user.matchPassword(trimmedPassword);
      console.log(`Password comparison result: ${isMatch}`);
      
      if (!isMatch) {
        // For debugging, let's check if the password is properly hashed
        const isBcryptHash = user.password.startsWith('$2a$') || user.password.startsWith('$2b$');
        console.log(`Is stored password a bcrypt hash? ${isBcryptHash}`);
        
        return res.status(401).json({ 
          message: 'Invalid credentials',
          debug: {
            passwordLength: trimmedPassword.length,
            storedHashPrefix: user.password.substring(0, 20),
            isBcryptHash: isBcryptHash
          }
        });
      }
    } catch (bcryptError) {
      console.error('Bcrypt error:', bcryptError);
      return res.status(500).json({ message: 'Password comparison error' });
    }
    
    console.log(`Password match for user: ${username}`);
    
    // Generate token
    const token = generateToken(user._id);
    
    // Send response
    res.json({
      _id: user._id,
      username: user.username,
      name: user.name,
      systemRole: user.systemRole,
      role: user.systemRole,
      clubRole: user.clubRole,
      club: user.club,
      status: user.status, // Include status in the response
      token
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    // Populate the clubs array to get full club information
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate({
        path: 'clubs._id',
        model: 'Club',
        select: 'name description'
      })
      .populate('club', 'name'); // Also populate the legacy club field
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Format the response to include all necessary fields
    const userData = {
      _id: user._id,
      username: user.username,
      name: user.name,
      systemRole: user.systemRole,
      role: user.systemRole, // For backward compatibility
      clubRole: user.clubRole,
      club: user.club, // Legacy club field
      clubs: user.clubs, // New clubs array
      points: user.points || 0, // Ensure points is included
      rewards: user.rewards || [], // Ensure rewards is included
      eventsAttended: user.eventsAttended || [], // Ensure eventsAttended is included
      ratings: user.ratings || [], // Ensure ratings is included
      joinDate: user.joinDate,
      status: user.status, // Include status
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
    
    console.log('User data being returned:', userData);
    res.json(userData);
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Change user password
// @route   POST /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Please provide current password and new password' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    
    // Use the setPassword method to avoid double hashing
    await user.setPassword(newPassword);
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a test user
// @route   POST /api/auth/create-test-user
// @access  Public
const createTestUser = async (req, res) => {
  try {
    const { username, password, name, systemRole } = req.body;
    
    // Check if user exists
    let user = await User.findOne({ username });
    
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Create user
    user = new User({
      username,
      password: password || 'Kmit123@', // Plain text password
      name: name || username,
      systemRole: systemRole || 'student'
    });
    
    // Use the setPassword method to avoid double hashing
    await user.setPassword(password || 'Kmit123@');
    
    res.json({ 
      message: 'Test user created successfully',
      user: {
        username: user.username,
        name: user.name,
        systemRole: user.systemRole
      }
    });
  } catch (error) {
    console.error('Create test user error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { username, newPassword } = req.body;
    
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Use the setPassword method to avoid double hashing
    await user.setPassword(newPassword || 'Kmit123@');
    
    res.json({ 
      message: 'Password reset successfully',
      username: user.username,
      newPassword: newPassword || 'Kmit123@'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const resetSpecificPassword = async (req, res) => {
  try {
    const { username, newPassword } = req.body;
    
    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }
    
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Use the setPassword method to avoid double hashing
    await user.setPassword(newPassword || 'Kmit123@');
    
    console.log(`Password reset for user: ${username}`);
    
    res.json({ 
      message: 'Password reset successfully',
      username: username,
      newPassword: newPassword || 'Kmit123@'
    });
  } catch (error) {
    console.error('Reset specific password error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Test simple password
// @route   POST /api/auth/test-simple-password
// @access  Public
const testSimplePassword = async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }
    
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Test with a simple password
    const simplePassword = "test123";
    
    // Use the setPassword method to avoid double hashing
    await user.setPassword(simplePassword);
    
    // Test comparison
    const isMatch = await user.matchPassword(simplePassword);
    
    res.json({ 
      message: 'Simple password test',
      username: username,
      password: simplePassword,
      hash: user.password.substring(0, 20) + "...",
      comparisonResult: isMatch
    });
  } catch (error) {
    console.error('Test simple password error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Debug student user
// @route   GET /api/auth/debug-student
// @access  Public
const debugStudentUser = async (req, res) => {
  try {
    const studentUsername = "23bd1a05c7"; // Replace with actual student username
    const user = await User.findOne({ username: studentUsername });
    
    if (!user) {
      return res.status(404).json({ 
        message: 'Student user not found',
        username: studentUsername
      });
    }
    
    res.json({
      exists: true,
      user: {
        _id: user._id,
        username: user.username,
        name: user.name,
        systemRole: user.systemRole,
        passwordHash: user.password.substring(0, 20) + "..." // Show partial hash
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Check student roles
// @route   GET /api/auth/check-student-roles
// @access  Public
const checkStudentRoles = async (req, res) => {
  try {
    const students = await User.find({ systemRole: 'student' });
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Comprehensive password debug
// @route   POST /api/auth/comprehensive-debug
// @access  Public
const comprehensiveDebug = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log(`Comprehensive debug for username: ${username}`);
    
    // Find user
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ 
        message: 'User not found',
        username: username
      });
    }
    
    // Get user details
    const userDetails = {
      _id: user._id,
      username: user.username,
      name: user.name,
      systemRole: user.systemRole,
      passwordHash: user.password,
      passwordLength: user.password.length,
      isBcryptHash: user.password.startsWith('$2a$') || user.password.startsWith('$2b$')
    };
    
    // Test password comparison
    const isMatch = await user.matchPassword(password);
    
    // Generate token
    const token = generateToken(user._id);
    
    return res.json({
      userDetails,
      enteredPassword: password,
      passwordMatch: isMatch,
      token,
      message: isMatch ? 'Login successful' : 'Password does not match',
      debug: {
        isStoredHashValidBcrypt: userDetails.isBcryptHash,
        storedHashLength: userDetails.passwordLength
      }
    });
  } catch (error) {
    console.error('Comprehensive debug error:', error);
    res.status(500).json({ 
      message: 'Server Error',
      error: error.message 
    });
  }
};

// @desc    Fix user password hash
// @route   POST /api/auth/fix-password
// @access  Public
const fixPassword = async (req, res) => {
  try {
    const { username, newPassword } = req.body;
    
    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }
    
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if the password is already a valid bcrypt hash
    const isBcryptHash = user.password.startsWith('$2a$') || user.password.startsWith('$2b$');
    
    if (isBcryptHash) {
      // Test if the password can be verified
      const isMatch = await user.matchPassword(newPassword || 'Kmit123@');
      
      if (isMatch) {
        return res.status(400).json({ 
          message: 'Password is already properly set and can be verified',
          currentHash: user.password.substring(0, 20) + '...'
        });
      }
    }
    
    // Use the setPassword method to avoid double hashing
    await user.setPassword(newPassword || 'Kmit123@');
    
    console.log(`Password fixed for user: ${username}`);
    
    res.json({ 
      message: 'Password fixed successfully',
      username: username,
      newPasswordHash: user.password.substring(0, 20) + '...'
    });
  } catch (error) {
    console.error('Fix password error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Verify and fix admin account
// @route   POST /api/auth/verify-fix-admin
// @access  Public
const verifyFixAdmin = async (req, res) => {
  try {
    const adminUsername = "deepa@kmit";
    const adminPassword = "Kmit123@";
    
    console.log(`Verifying admin account: ${adminUsername}`);
    
    // Check if admin exists
    let admin = await User.findOne({ username: adminUsername });
    
    if (!admin) {
      console.log(`Admin user not found, creating new admin user`);
      
      // Create admin user
      admin = new User({
        username: adminUsername,
        password: adminPassword, // Plain text password
        systemRole: "admin",
        name: "Deepa Admin",
      });
      
      // Use the setPassword method to avoid double hashing
      await admin.setPassword(adminPassword);
      console.log(`Admin user created successfully`);
    } else {
      console.log(`Admin user found, checking password hash`);
      
      // Check if password is properly hashed
      const isBcryptHash = admin.password.startsWith('$2a$') || admin.password.startsWith('$2b$');
      console.log(`Is password a bcrypt hash? ${isBcryptHash}`);
      
      // Test password comparison
      const isMatch = await admin.matchPassword(adminPassword);
      console.log(`Password comparison result: ${isMatch}`);
      
      if (!isMatch) {
        console.log(`Password comparison failed, resetting password...`);
        
        // Use the setPassword method to avoid double hashing
        await admin.setPassword(adminPassword);
        console.log(`Admin password reset`);
      }
    }
    
    // Verify admin can log in
    const testLogin = await admin.matchPassword(adminPassword);
    console.log(`Final login test result: ${testLogin}`);
    
    res.json({
      success: true,
      message: testLogin ? "Admin account is ready for login" : "Failed to setup admin account",
      username: adminUsername,
      password: adminPassword,
      loginTest: testLogin
    });
  } catch (error) {
    console.error('Verify/fix admin error:', error);
    res.status(500).json({ 
      message: 'Server Error',
      error: error.message 
    });
  }
};

// @desc    Debug login
// @route   POST /api/auth/debug-login
// @access  Public
const debugLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log(`Debug login attempt for username: ${username}`);
    
    // Find user
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ 
        message: 'User not found',
        username: username
      });
    }
    
    console.log(`User found:`, {
      username: user.username,
      systemRole: user.systemRole,
      passwordHash: user.password.substring(0, 20) + "..."
    });
    
    // Test password comparison
    const isMatch = await user.matchPassword(password);
    console.log(`Password match result: ${isMatch}`);
    
    // Generate token if password matches
    let token = null;
    if (isMatch) {
      token = generateToken(user._id);
    }
    
    // Return detailed information
    return res.json({
      userFound: true,
      username: user.username,
      systemRole: user.systemRole,
      passwordMatch: isMatch,
      token: token,
      message: isMatch ? 'Login successful' : 'Password does not match'
    });
  } catch (error) {
    console.error('Debug login error:', error);
    res.status(500).json({ 
      message: 'Server Error',
      error: error.message 
    });
  }
};

// @desc    Debug password
// @route   POST /api/auth/debug-password
// @access  Public
const debugPassword = async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }
    
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const isBcryptHash = user.password.startsWith('$2a$') || user.password.startsWith('$2b$');
    
    res.json({
      username: user.username,
      passwordHash: user.password,
      isBcryptHash: isBcryptHash,
      hashLength: user.password.length
    });
  } catch (error) {
    console.error('Debug password error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Fix password hash
// @route   POST /api/auth/fix-password-hash
// @access  Public
const fixPasswordHash = async (req, res) => {
  try {
    const { username, newPassword } = req.body;
    
    if (!username || !newPassword) {
      return res.status(400).json({ message: 'Username and new password are required' });
    }
    
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Use the setPassword method to properly hash the password
    await user.setPassword(newPassword);
    
    res.json({
      message: 'Password hash fixed successfully',
      username: username,
      newPasswordHash: user.password.substring(0, 20) + '...'
    });
  } catch (error) {
    console.error('Fix password hash error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  login,
  getMe,
  changePassword,
  createTestUser,
  resetPassword,
  resetSpecificPassword,
  testSimplePassword,
  debugStudentUser,
  checkStudentRoles,
  comprehensiveDebug,
  fixPassword,
  verifyFixAdmin,
  debugLogin,
  debugPassword,
  fixPasswordHash
};