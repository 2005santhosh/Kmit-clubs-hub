require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const clubRoutes = require("./routes/clubs");
const userRoutes = require("./routes/userRoutes");
const userRoutesLegacy = require("./routes/users");
const roleRoutes = require("./routes/roles");
const permissionRoutes = require("./routes/permissions");
const eventRoutes = require("./routes/events");
const reportRoutes = require("./routes/reports");
const uploadRoutes = require("./routes/uploadRoutes");
const analyticsRoutes = require("./routes/analytics");
const notificationRoutes = require("./routes/notifications");
const approvalRoutes = require("./routes/approvals");
const dashboardRoutes = require('./routes/dashboard');
const clubLeadersRoutes = require('./routes/clubLeaders');
const clubActivityReportsRouter = require('./routes/clubActivityReports');
const rewardRoutes = require('./routes/rewardRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const studentRoutes = require('./routes/studentRoutes');
const userAnalyticsRoutes = require('./routes/userAnalytics');
const userActivityRoutes = require('./routes/userActivity');
const recentActivityRoutes = require('./routes/recentActivity');
const { connectRedis } = require("./config/redis");
const Club = require("./models/Club");
const Role = require("./models/Role");
const Permission = require("./models/Permission");
const Event = require("./models/Event");
const User = require("./models/User");
const Approval = require("./models/Approval");
const ClubActivityReport = require("./models/ClubActivityReport");
const Notification = require("./models/Notification");
const Report = require("./models/Report");
const Reward = require("./models/Reward");
const userPointsRoutes = require('./routes/userPoints');
const earnedRewardsRoutes = require('./routes/earnedRewards');

// Import auth middleware
const jwt = require('jsonwebtoken');

// Proper authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET || 'kmitclubshub', (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Proper authorization middleware - UPDATED with fallback to legacy 'role'
const authorizeRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Fallback to legacy 'role' if systemRole is missing
    const userRole = req.user.systemRole || req.user.role;
    
    // Enhanced logging
    console.log('Auth check:', { 
      username: req.user.username || 'unknown', 
      systemRole: req.user.systemRole, 
      fallbackRole: req.user.role, 
      finalRole: userRole, 
      allowed: allowedRoles 
    });
    
    if (!allowedRoles.includes(userRole)) {
      console.log(`Role mismatch: ${userRole} not in [${allowedRoles.join(', ')}]`);
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    
    next();
  };
};

// JWT token generation function
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'kmitclubshub', {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

// Multer for file uploads
const multer = require("multer");
const fs = require("fs");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = process.env.UPLOAD_PATH || path.join(__dirname, "../public/uploads/events");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
});

const app = express();

// Connect to MongoDB
connectDB();

// Connect to Redis
connectRedis();

// Security middleware - FIXED: Added scriptSrcAttr: ["'unsafe-inline'"] to allow inline event handlers (e.g., onclick) across all static pages, resolving the global CSP violation for event handlers on pages like student_dashboard.html and others. Retained 'unsafe-inline' for script-src and style-src.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net"
        ],
        scriptSrcAttr: [
          "'unsafe-inline'" // Added to allow inline event handlers like onclick, etc.
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdnjs.cloudflare.com",
          "https://fonts.googleapis.com"
        ],
        fontSrc: [
          "'self'",
          "https://cdnjs.cloudflare.com",
          "https://fonts.gstatic.com"
        ],
        imgSrc: [
          "'self'",
          "data:",
          "https:",
          "http://localhost:3000"
        ],
        connectSrc: [
          "'self'",
          "https://kmit-clubs-hub.onrender.com",
          "http://localhost:3000",
          "https://cdn.jsdelivr.net"
        ],
        frameAncestors: ["'none'"],
        formAction: ["'self'"]
      },
    },
    crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production',
  })
);

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 1000, // limit each IP to 5 requests per windowMs for auth
  message: "Too many requests from this IP, please try again later.",
});

const generalLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});

// Full club details endpoint - MOVED BEFORE clubRoutes to make it public and match first
// Full club details endpoint - PUBLIC (before auth routes)
app.get("/api/clubs/:id/full", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid club ID format' });
    }

    const club = await Club.findById(id)
      .populate('faculty', 'name username department role systemRole')  // Direct field
      .populate('leader', 'name username role systemRole')              // Direct field
      .populate({
        path: 'members.user',  // FIXED: Use 'user' key from schema, not '_id'
        select: 'name username email'  // Add email if needed; populated now
      })
      .populate({
        path: 'events',
        select: 'title date status description thumbnail'  // FIXED: Add description & thumbnail for gallery/events
      });

    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    // Log for debugging (remove after fix)
    console.log('Populated Club Debug:', {
      name: club.name,
      leader: club.leader ? `${club.leader.name} (${club.leader.username})` : 'None',
      faculty: club.faculty ? `${club.faculty.name} (${club.faculty.username})` : 'None',
      members: club.members.map(m => ({ role: m.role, user: m.user ? `${m.user.name} (${m.user.username})` : 'Unpopulated' })),
      events: club.events.map(e => ({ title: e.title, description: e.description }))
    });

    res.json(club);
  } catch (error) {
    console.error('Club fetch error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

app.use('/api/auth', authLimiter);
// Add this route in server.js (after app.use("/api/auth", authRoutes);)
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)  // Use req.user.id (from JWT)
      .select('-password')
      .populate('club', 'name description type registerLink bannerImage')  // Legacy single club
      .populate({
        path: 'clubs._id',  // Populate nested club refs in array
        select: 'name description type registerLink bannerImage'
      });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Ensure consistent 'role' for frontend (fallback from systemRole)
    const userObj = user.toObject();
    userObj.role = userObj.systemRole || userObj.role;

    res.json(userObj);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});
app.use(generalLimiter);

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
}));

// Body parser middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static files
app.use(express.static(path.join(__dirname, "../public")));
// Add this to serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.get("/event-details.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/event-details.html"));
});
app.get("/report-details.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/report-details.html"));
});
// Routes
app.use("/api/auth", authRoutes);
app.use("/api/clubs", clubRoutes);
app.use("/api/users", userRoutes);
app.use("/api/users-legacy", userRoutesLegacy);
app.use("/api/roles", roleRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/approvals", approvalRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/club-leaders', clubLeadersRoutes);
app.use("/api/rewards", rewardRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/userAnalytics", userAnalyticsRoutes);
app.use("/api/userActivity", userActivityRoutes);
app.use("/api/recentActivity", recentActivityRoutes);

// Add a specific DELETE route for clubactivityreports before using the router
app.delete("/api/clubactivityreports/:id", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const reportId = req.params.id;
    console.log(`Attempting to delete report with ID: ${reportId} from clubactivityreports collection`);
    
    // Check if ID is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      console.log(`Invalid ObjectId format: ${reportId}`);
      return res.status(400).json({ message: 'Invalid report ID format' });
    }
    
    const report = await ClubActivityReport.findById(reportId);
    if (!report) {
      console.log(`Report not found with ID: ${reportId} in clubactivityreports collection`);
      return res.status(404).json({ message: 'Report not found' });
    }
    
    console.log(`Found report: ${report.title}, deleting now...`);
    await ClubActivityReport.findByIdAndDelete(reportId);
    console.log(`Successfully deleted report with ID: ${reportId}`);
    
    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error(`Error deleting report:`, error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// Now use the router for other routes
app.use("/api/clubactivityreports", clubActivityReportsRouter);

// DELETE endpoint for reports collection
app.delete("/api/reports/:id", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const reportId = req.params.id;
    console.log(`Attempting to delete report with ID: ${reportId} from reports collection`);
    
    // Check if ID is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      console.log(`Invalid ObjectId format: ${reportId}`);
      return res.status(400).json({ message: 'Invalid report ID format' });
    }
    
    const report = await Report.findById(reportId);
    if (!report) {
      console.log(`Report not found with ID: ${reportId} in reports collection`);
      return res.status(404).json({ message: 'Report not found' });
    }
    
    console.log(`Found report: ${report.name}, deleting now...`);
    await Report.findByIdAndDelete(reportId);
    console.log(`Successfully deleted report with ID: ${reportId}`);
    
    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error(`Error deleting report:`, error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// Image upload route
app.post('/api/upload/event-image', authenticateToken, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const fileUrl = `/uploads/events/${req.file.filename}`;
    res.json({
      success: true,
      url: fileUrl,
      message: 'Image uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ success: false, message: 'Failed to upload image' });
  }
});

// Password change route (legacy)
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    
    // Find user
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    
    // Validate new password
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters long' });
    }
    
    // Use the setPassword method to avoid double hashing
    await user.setPassword(newPassword);
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reset all passwords to default
app.post('/api/auth/reset-all-passwords', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    // Only allow admins to access this endpoint
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    
    // Check if user is admin
    const adminUser = await User.findById(decoded.id);
    if (!adminUser || adminUser.systemRole !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Get all users
    const users = await User.find({});
    const defaultPassword = 'Kmit123$';
    const salt = await bcrypt.genSalt(10);
    const hashedDefaultPassword = await bcrypt.hash(defaultPassword, salt);
    
    // Update all passwords
    for (const user of users) {
      user.password = hashedDefaultPassword;
      await user.save();
    }
    
    res.json({ 
      message: `All passwords have been reset to default: ${defaultPassword}`,
      usersUpdated: users.length
    });
  } catch (error) {
    console.error('Error resetting passwords:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Temp Debug: Check and fix user status - REMOVE AFTER USE
app.get('/api/debug/user-status/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username }).select('username status systemRole');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log(`User ${username}: status="${user.status}", systemRole="${user.systemRole}"`);
    
    // Force set to active if not
    if (user.status !== 'active') {
      user.status = 'active';
      await user.save();
      console.log(`Fixed status for ${username} to 'active'`);
    }
    
    res.json({ 
      username: user.username, 
      originalStatus: user.status,  // Before any fix
      systemRole: user.systemRole 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Debug endpoints for authentication
app.get("/api/auth/check-user/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username }).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      exists: true,
      user: {
        _id: user._id,
        username: user.username,
        name: user.name,
        systemRole: user.systemRole,
        clubRole: user.clubRole
      }
    });
  } catch (error) {
    console.error('Check user error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

app.post("/api/auth/reset-user-password", async (req, res) => {
  try {
    const { username, newPassword } = req.body;
    
    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }
    
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword || 'Kmit123@', salt);
    
    user.password = hashedPassword;
    await user.save();
    
    console.log(`Password reset for user: ${username}`);
    
    res.json({ 
      message: 'Password reset successfully',
      username: username,
      newPassword: newPassword || 'Kmit123@'
    });
  } catch (error) {
    console.error('Reset user password error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

app.post("/api/auth/simple-create-user", async (req, res) => {
  try {
    const { username, password, name, role } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const user = new User({
      username,
      password: hashedPassword,
      name: name || username,
      systemRole: role || 'student'
    });
    
    await user.save();
    
    console.log(`User created: ${username}, role: ${role || 'student'}`);
    
    res.json({ 
      message: 'User created successfully',
      user: {
        username: user.username,
        name: user.name,
        systemRole: user.systemRole
      }
    });
  } catch (error) {
    console.error('Simple create user error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

app.post("/api/auth/test-login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log(`Test login attempt for username: ${username}`);
    
    // Find user
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ 
        message: 'User not found',
        username: username
      });
    }
    
    console.log(`User found: ${username}, role: ${user.systemRole}`);
    
    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    console.log(`Password match: ${isMatch}`);
    
    if (!isMatch) {
      return res.status(401).json({ 
        message: 'Invalid credentials',
        username: username,
        passwordMatch: false
      });
    }
    
    // Generate token
    const token = generateToken(user._id);
    
    console.log(`Login successful for user: ${username}`);
    
    // Send response
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        _id: user._id,
        username: user.username,
        name: user.name,
        systemRole: user.systemRole,
        role: user.systemRole,
        clubRole: user.clubRole
      },
      token
    });
    
  } catch (error) {
    console.error('Test login error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

app.post("/api/auth/comprehensive-debug", async (req, res) => {
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
      clubRole: user.clubRole,
      passwordHash: user.password,
      passwordLength: user.password.length
    };
    
    // Test password comparison
    const isMatch = await bcrypt.compare(password, user.password);
    
    // Try to hash the entered password and compare
    const salt = await bcrypt.genSalt(10);
    const hashedEnteredPassword = await bcrypt.hash(password, salt);
    
    // Generate token
    const token = generateToken(user._id);
    
    return res.json({
      userDetails,
      enteredPassword: password,
      hashedEnteredPassword,
      passwordMatch: isMatch,
      token,
      message: isMatch ? 'Login successful' : 'Password does not match'
    });
    
  } catch (error) {
    console.error('Comprehensive debug error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

app.post("/api/auth/debug-login", async (req, res) => {
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
      clubRole: user.clubRole,
      passwordHash: user.password
    });
    
    // Test password comparison
    const isMatch = await bcrypt.compare(password, user.password);
    console.log(`Password match result: ${isMatch}`);
    
    // Generate token regardless of password match for testing
    const token = generateToken(user._id);
    
    // Return detailed information
    return res.json({
      userFound: true,
      username: user.username,
      systemRole: user.systemRole,
      clubRole: user.clubRole,
      passwordMatch: isMatch,
      token: token,
      message: isMatch ? 'Login successful' : 'Password does not match but token generated for testing'
    });
  } catch (error) {
    console.error('Debug login error:', error);
    res.status(500).json({ 
      message: 'Server Error',
      error: error.message 
    });
  }
});

app.post("/api/auth/create-user-direct", async (req, res) => {
  try {
    const { username, password, name, systemRole } = req.body;
    
    // Check if user exists
    let user = await User.findOne({ username });
    
    if (user) {
      // Update existing user
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      user.password = hashedPassword;
      user.name = name || user.name;
      user.systemRole = systemRole || user.systemRole;
      
      await user.save();
      
      return res.json({
        message: 'User updated successfully',
        username: user.username,
        password: password,
        systemRole: user.systemRole
      });
    } else {
      // Create new user
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      user = new User({
        username,
        password: hashedPassword,
        name: name || username,
        systemRole: systemRole || 'student'
      });
      
      await user.save();
      
      return res.json({
        message: 'User created successfully',
        username: user.username,
        password: password,
        systemRole: user.systemRole
      });
    }
  } catch (error) {
    console.error('Create user direct error:', error);
    res.status(500).json({ 
      message: 'Server Error',
      error: error.message 
    });
  }
});

app.post("/api/auth/create-student-user", async (req, res) => {
  try {
    const { username, password, name } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Hash password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create student user
    const user = new User({
      username,
      password: hashedPassword,
      name: name || username,
      systemRole: 'student'
    });
    
    await user.save();
    
    console.log(`Student user created: ${username}, role: student`);
    
    res.json({ 
      message: 'Student user created successfully',
      user: {
        username: user.username,
        name: user.name,
        systemRole: user.systemRole
      }
    });
  } catch (error) {
    console.error('Create student user error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

app.post("/api/auth/test-student-login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log(`Student login test for username: ${username}`);
    
    // Find user
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ 
        message: 'User not found',
        username: username
      });
    }
    
    // Check if user is a student
    if (user.systemRole !== 'student') {
      return res.status(400).json({ 
        message: 'User is not a student',
        username: username,
        systemRole: user.systemRole
      });
    }
    
    console.log(`Student user found: ${username}, role: ${user.systemRole}`);
    
    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    console.log(`Password match: ${isMatch}`);
    
    if (!isMatch) {
      return res.status(401).json({ 
        message: 'Invalid credentials',
        username: username,
        passwordMatch: false
      });
    }
    
    // Generate token
    const token = generateToken(user._id);
    
    console.log(`Student login successful for user: ${username}`);
    
    // Send response
    res.json({
      success: true,
      message: 'Student login successful',
      user: {
        _id: user._id,
        username: user.username,
        name: user.name,
        systemRole: user.systemRole,
        role: user.systemRole,
        clubRole: user.clubRole
      },
      token
    });
    
  } catch (error) {
    console.error('Student login test error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

app.post("/api/auth/debug-student-login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log(`Comprehensive student debug for username: ${username}`);
    
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
      clubRole: user.clubRole,
      passwordHash: user.password,
      passwordLength: user.password.length
    };
    
    // Check if user is a student
    const isStudent = user.systemRole === 'student';
    
    // Test password comparison
    const isMatch = await bcrypt.compare(password, user.password);
    
    // Try to hash the entered password and compare
    const salt = await bcrypt.genSalt(10);
    const hashedEnteredPassword = await bcrypt.hash(password, salt);
    
    // Generate token
    const token = generateToken(user._id);
    
    return res.json({
      userDetails,
      enteredPassword: password,
      hashedEnteredPassword,
      isStudent,
      passwordMatch: isMatch,
      token,
      message: isMatch ? 'Student login successful' : 'Password does not match'
    });
    
  } catch (error) {
    console.error('Comprehensive student debug error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// Add these routes after your existing auth routes

// Debug routes
app.get("/api/auth/debug-student", async (req, res) => {
  try {
    const { debugStudentUser } = require('./controllers/authController');
    await debugStudentUser(req, res);
  } catch (error) {
    console.error('Debug student error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

app.get("/api/auth/check-student-roles", async (req, res) => {
  try {
    const { checkStudentRoles } = require('./controllers/authController');
    await checkStudentRoles(req, res);
  } catch (error) {
    console.error('Check student roles error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

app.post("/api/auth/reset-specific-password", async (req, res) => {
  try {
    const { resetSpecificPassword } = require('./controllers/authController');
    await resetSpecificPassword(req, res);
  } catch (error) {
    console.error('Reset specific password error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

app.post("/api/auth/test-simple-password", async (req, res) => {
  try {
    const { testSimplePassword } = require('./controllers/authController');
    await testSimplePassword(req, res);
  } catch (error) {
    console.error('Test simple password error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Consolidated comprehensive-debug (remove duplicates)
app.post("/api/auth/comprehensive-debug", async (req, res) => {
  try {
    const { comprehensiveDebug } = require('./controllers/authController');
    await comprehensiveDebug(req, res);
  } catch (error) {
    console.error('Comprehensive debug error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

app.post("/api/auth/fix-password", async (req, res) => {
  try {
    const { fixPassword } = require('./controllers/authController');
    await fixPassword(req, res);
  } catch (error) {
    console.error('Fix password error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Manual endpoint to reset student passwords
app.post("/api/auth/reset-student-passwords", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    // Only allow admins to access this endpoint
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    
    // Check if user is admin
    const adminUser = await User.findById(decoded.id);
    if (!adminUser || adminUser.systemRole !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Find all student users
    const students = await User.find({ systemRole: "student" });
    
    if (students.length === 0) {
      return res.status(404).json({ message: 'No student users found' });
    }
    
    // Hash the default password
    const defaultPassword = "Kmit123@";
    const salt = await bcrypt.genSalt(10);
    const hashedDefaultPassword = await bcrypt.hash(defaultPassword, salt);
    
    let updatedCount = 0;
    
    // Update each student's password
    for (const student of students) {
      student.password = hashedDefaultPassword;
      await student.save();
      updatedCount++;
    }
    
    res.json({ 
      message: `All student passwords have been reset to default: ${defaultPassword}`,
      studentsUpdated: updatedCount
    });
  } catch (error) {
    console.error('Error resetting student passwords:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Endpoint to list all students (without passwords)
app.get("/api/auth/list-students", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    // Only allow admins to access this endpoint
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    
    // Check if user is admin
    const adminUser = await User.findById(decoded.id);
    if (!adminUser || adminUser.systemRole !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Get all students without password field
    const students = await User.find({ systemRole: "student" }).select('-password');
    
    res.json({
      count: students.length,
      students: students
    });
  } catch (error) {
    console.error('Error listing students:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Endpoint to verify a student's password
app.post("/api/auth/verify-student-password", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
    
    // Find student user
    const student = await User.findOne({ username, systemRole: "student" });
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    // Verify password
    const isMatch = await bcrypt.compare(password, student.password);
    
    res.json({
      username: student.username,
      passwordMatch: isMatch,
      message: isMatch ? 'Password is correct' : 'Password is incorrect'
    });
  } catch (error) {
    console.error('Error verifying student password:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin endpoint to fix club members points
app.post("/api/admin/fix-club-members-points", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    // Only allow admins to access this endpoint
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    
    // Check if user is admin
    const adminUser = await User.findById(decoded.id);
    if (!adminUser || adminUser.systemRole !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Find all users who are club members (have at least one club in their clubs array)
    const clubMembers = await User.find({ 
      clubs: { $exists: true, $ne: [] }
    });

    let updatedCount = 0;

    for (const user of clubMembers) {
      // If the user has less than 10 points, set to 10
      if (user.points < 10) {
        user.points = 10;
        await user.save();
        updatedCount++;
      }
    }

    res.json({ 
      message: `Fixed club members points. Updated ${updatedCount} users.`,
      updatedCount
    });
  } catch (error) {
    console.error("Error fixing club members points:", error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Debug endpoint to check club members points
app.get("/api/debug/club-members-points", async (req, res) => {
  try {
    // Find all users who are club members
    const clubMembers = await User.find({ 
      clubs: { $exists: true, $ne: [] }
    }).select('name username points clubs');

    const memberDetails = clubMembers.map(member => ({
      name: member.name,
      username: member.username,
      points: member.points,
      clubCount: member.clubs.length,
      hasMinimumPoints: member.points >= 10
    }));

    res.json({
      totalClubMembers: clubMembers.length,
      members: memberDetails
    });
  } catch (error) {
    console.error('Error fetching club members points:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// NEW: Endpoint to assign a club to a faculty user
app.post("/api/users/assign-club", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { userId, clubId, role } = req.body;
    
    if (!userId || !clubId) {
      return res.status(400).json({ message: 'User ID and Club ID are required' });
    }
    
    // Check if the IDs are valid ObjectIds
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(clubId)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    
    // Find the user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user is faculty
    if (user.systemRole !== 'faculty') {
      return res.status(400).json({ message: 'Only faculty users can be assigned to clubs' });
    }
    
    // Find the club
    const club = await Club.findById(clubId);
    
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }
    
    // Update user's club and clubRole
    user.club = clubId;
    user.clubRole = role || 'faculty';
    
    await user.save();
    
    // Get updated user with populated club info
    const updatedUser = await User.findById(userId)
      .select('-password')
      .populate('club', 'name');
    
    res.json({ 
      message: 'Club assigned successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error assigning club:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Full club details endpoint
// app.get("/api/clubs/:id/full", async (req, res) => {
//   try {
//     const { id } = req.params;

//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({ message: 'Invalid club ID format' });
//     }

//     const club = await Club.findById(id)
//       .populate('faculty', 'name username department role systemRole')
//       .populate('leader', 'name username role systemRole')
//       .populate('members._id', 'name username')
//       .populate('events', 'title date status');

//     if (!club) {
//       return res.status(404).json({ message: 'Club not found' });
//     }

//     res.json(club);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Server Error' });
//   }
// });

// Serve HTML pages
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/login.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/dashboard.html"));
});

app.get("/clubs", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/clubs.html"));
});

app.get("/system-settings", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/system-settings.html"));
});

app.get("/role-management", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/role-management.html"));
});

app.get("/user-management", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/user-management.html"));
});

app.get("/event-management", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/event-management.html"));
});

app.get("/reports", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/reports.html"));
});

app.get("/analytics", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/analytics.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin.html"));
});

app.get("/activity-log", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/activity-log.html"));
});

// Role-based dashboard redirects
app.get("/student_dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/student_dashboard.html"));
});

app.get("/club_leader_dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/club_leader_dashboard.html"));
});

app.get("/faculty_dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/faculty_dashboard.html"));
});

// Faculty-specific routes
app.get("/approvals", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/approvals.html"));
});

app.get("/monitored-clubs", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/monitored-clubs.html"));
});

app.get("/faculty_reports", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/faculty_reports.html"));
});

app.get("/faculty_analytics", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/faculty_analytics.html"));
});

app.get("/faculty_settings", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/faculty_settings.html"));
});

// Club events page
app.get("/club-events", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/club-events.html"));
});

app.get("/event-details", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/event-details.html"));
});

app.get("/add-event", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/add-event.html"));
});

app.get("/club-details", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/club-details.html"));
});

app.get("/clubs_detail", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/clubs_detail.html"));
});

app.get("/report-details", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/report-details.html"));
});

// Club Leader specific routes
app.get("/leader-user-management", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/leader-user-management.html"));
});

app.get("/leader-events", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/leader-events.html"));
});

app.get("/leader-reports", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/leader-reports.html"));
});

app.get("/leader-analytics", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/leader-analytics.html"));
});

app.get("/leader-settings", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/leader-settings.html"));
});

// Student-specific routes
app.get("/student_dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/Student_dashboard.html"));
});

app.get("/student_clubs", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/student_clubs.html"));
});

app.get("/student_events", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/student_events.html"));
});

app.get("/student_rewards", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/student_rewards.html"));
});

app.get("/student_analytics", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/student_analytics.html"));
});

app.get("/student_settings", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/student_settings.html"));
});

// Debug endpoints
app.get("/api/debug/user-roles", async (req, res) => {
  try {
    const users = await User.find({});
    const roleCounts = {};
    users.forEach((user) => {
      // Use systemRole if available, otherwise fall back to role
      const userRole = user.systemRole || user.role;
      roleCounts[userRole] = (roleCounts[userRole] || 0) + 1;
    });

    const roles = await Role.find({});
    const roleMapping = {
      Admin: "admin",
      Faculty: "faculty",
      "Club Leader": "clubLeader",
      Student: "student",
    };

    const roleUserCounts = {};
    roles.forEach((role) => {
      const userRoleValue = roleMapping[role.name];
      if (userRoleValue) {
        roleUserCounts[role.name] = roleCounts[userRoleValue] || 0;
      } else {
        roleUserCounts[role.name] = 0;
      }
    });

    res.json({
      totalUsers: users.length,
      userRoles: roleCounts,
      roles: roles.map((role) => ({
        name: role.name,
        userCount: roleUserCounts[role.name],
      })),
      mapping: roleMapping,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/debug/clubs", async (req, res) => {
  try {
    const clubs = await Club.find({})
      .populate("faculty", "name username systemRole email")
      .populate("leader", "name username systemRole email");
    res.json(clubs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// FIXED: Updated debug endpoint to correctly populate members
app.get("/api/debug/clubs/:id", async (req, res) => {
  try {
    const club = await Club.findById(req.params.id)
      .populate("faculty", "name username systemRole email")
      .populate("leader", "name username systemRole email")
      .populate({
        path: "members._id",
        select: "name username systemRole clubRole email joinDate status"
      })
      .populate({
        path: "events",
        select: "title date venue status description",
      });

    if (!club) {
      return res.status(404).json({ message: "Club not found" });
    }

    res.json(club);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// NEW: Debug endpoint to show raw club structure
app.get("/api/debug/club-raw/:id", async (req, res) => {
  try {
    const club = await Club.findById(req.params.id).lean();
    
    if (!club) {
      return res.status(404).json({ message: "Club not found" });
    }

    // Return the raw club data without any population
    res.json({
      clubId: club._id,
      clubName: club.name,
      members: club.members, // This will show the raw structure
      membersCount: club.members ? club.members.length : 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// NEW: Debug endpoint to check club members
app.get("/api/debug/club-members/:id", async (req, res) => {
  try {
    const club = await Club.findById(req.params.id)
      .populate('faculty', 'name username systemRole')
      .populate('leader', 'name username systemRole')
      .populate({
        path: 'members._id',
        select: 'name username systemRole clubRole email'
      });
    
    if (!club) {
      return res.status(404).json({ message: "Club not found" });
    }

    // Return detailed information about the club and its members
    res.json({
      clubId: club._id,
      clubName: club.name,
      faculty: club.faculty,
      leader: club.leader,
      members: club.members.map(member => ({
        id: member._id._id,
        username: member._id.username,
        name: member._id.name,
        systemRole: member._id.systemRole,
        clubRole: member.role, // This is the role in the club's members array
        userClubRole: member._id.clubRole // This is the clubRole in the User model
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/debug/events", async (req, res) => {
  try {
    const events = await Event.find({}).populate("clubId", "name").populate("organizer", "name");
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/debug/faculty", async (req, res) => {
  try {
    const faculty = await User.find({ systemRole: "faculty" });
    res.json(faculty);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/debug/club-leaders", async (req, res) => {
  try {
    const leaders = await User.find({ systemRole: "clubLeader" });
    res.json(leaders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/debug/reports", async (req, res) => {
  try {
    const reports = await ClubActivityReport.find({})
      .populate("club", "name")
      .populate("submittedBy", "name")
      .populate("approvedBy", "name");
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/debug/notifications", async (req, res) => {
  try {
    const notifications = await Notification.find({})
      .populate("sender", "name")
      .populate("recipients", "name");
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// NEW: Cleanup endpoint for invalid member references
app.post("/api/clubs/cleanup-members", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    // Only allow admins to access this endpoint
    if (!req.user || req.user.systemRole !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const clubs = await Club.find({});
    let totalCleaned = 0;
    
    for (const club of clubs) {
      const validMembers = [];
      let cleanedCount = 0;
      
      for (const member of club.members) {
        // Check if the user exists
        const user = await User.findById(member._id);
        if (user) {
          validMembers.push(member);
        } else {
          cleanedCount++;
          console.log(`Removing invalid member reference: ${member._id} from club: ${club.name}`);
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
});

// Add these endpoints after your existing auth routes

// Debug routes
app.post("/api/auth/verify-fix-admin", async (req, res) => {
  try {
    const { verifyFixAdmin } = require('./controllers/authController');
    await verifyFixAdmin(req, res);
  } catch (error) {
    console.error('Verify fix admin error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

app.post("/api/auth/debug-login", async (req, res) => {
  try {
    const { debugLogin } = require('./controllers/authController');
    await debugLogin(req, res);
  } catch (error) {
    console.error('Debug login error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);

  if (err.name === "CastError") {
    return res.status(400).json({ message: "Invalid ID format" });
  }

  if (err.code === 11000) {
    return res.status(400).json({ message: "Duplicate field value" });
  }

  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({ message: messages.join(", ") });
  }

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "File size too large" });
  }

  if (err.message === "Only image files are allowed!") {
    return res.status(400).json({ message: "Only image files are allowed" });
  }

  res.status(500).json({ message: "Server Error" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Create default admin if not exists
const createDefaultAdmin = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.log("MongoDB not connected, skipping admin creation");
      return;
    }

    const adminExists = await User.findOne({ username: "deepa@kmit" });

    if (!adminExists) {
      // Create admin with plain text password
      const admin = new User({
        username: "deepa@kmit",
        password: "Kmit123@", // Plain text password
        systemRole: "admin",
        role: "admin", // Also set the old role field for backward compatibility
        name: "Deepa Admin",
      });
      
      // Use the setPassword method to avoid double hashing
      await admin.setPassword("Kmit123@");
      
      console.log("Default admin created with password: Kmit123@ and role: admin");
    } else {
      console.log("Default admin already exists");
      
      // Check if the role is correct
      if (adminExists.systemRole !== "admin" || adminExists.role !== "admin") {
        console.log(`Admin role is incorrect (${adminExists.systemRole}), fixing...`);
        adminExists.systemRole = "admin";
        adminExists.role = "admin"; // Also update the old role field
        await adminExists.save();
        console.log("Admin role fixed to: admin");
      } else {
        console.log("Admin role is already correct");
      }
      
      // Check if the password is properly hashed
      const isBcryptHash = adminExists.password.startsWith('$2a$') || adminExists.password.startsWith('$2b$');
      console.log(`Is admin password a bcrypt hash? ${isBcryptHash}`);
      
      // Test if the password can be verified
      const isMatch = await adminExists.matchPassword("Kmit123@");
      console.log(`Can admin password be verified? ${isMatch}`);
      
      if (!isMatch) {
        console.log("Admin password verification failed, resetting...");
        
        // Use the setPassword method to avoid double hashing
        await adminExists.setPassword("Kmit123@");
        
        console.log("Admin password reset");
      } else {
        console.log("Admin password is properly set and can be verified");
      }
    }
  } catch (error) {
    console.error("Error creating default admin:", error.message);
  }
};

// Fix user roles
const fixUserRoles = async () => {
  try {
    const usersWithoutRoles = await User.countDocuments({ systemRole: { $exists: false } });
    console.log(`Found ${usersWithoutRoles} users without systemRole`);

    if (usersWithoutRoles > 0) {
      const result = await User.updateMany(
        { systemRole: { $exists: false } }, 
        { $set: { systemRole: "student" } }
      );
      console.log(`Updated ${result.modifiedCount} users with default systemRole 'student'`);
    }

    // Also fix users with old 'role' field
    const usersWithOldRole = await User.find({ role: { $exists: true } });
    console.log(`Found ${usersWithOldRole.length} users with old 'role' field`);

    for (const user of usersWithOldRole) {
      user.systemRole = user.role;
      delete user.role; // Remove the old field
      await user.save();
      console.log(`Updated user ${user.username} from old 'role' to new 'systemRole'`);
    }

    const roleCounts = await User.aggregate([
      {
        $group: {
          _id: "$systemRole",
          count: { $sum: 1 },
        },
      },
    ]);

    console.log("User counts by systemRole after update:");
    roleCounts.forEach((item) => {
      console.log(`  ${item._id}: ${item.count}`);
    });
  } catch (error) {
    console.error("Error fixing user roles:", error);
  }
};

// Create default roles and permissions
const createDefaultRolesAndPermissions = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.log("MongoDB not connected, skipping roles and permissions creation");
      return;
    }

    const defaultPermissions = [
      { name: "View Events" },
      { name: "Register for Events" },
      { name: "Create Events" },
      { name: "Manage Club Members" },
      { name: "Approve Events" },
      { name: "Manage Users" },
      { name: "Manage Roles" },
      { name: "System Settings" },
    ];

    const permissions = [];
    for (const permData of defaultPermissions) {
      let perm = await Permission.findOne({ name: permData.name });
      if (!perm) {
        perm = await Permission.create(permData);
        console.log(`Created permission: ${perm.name}`);
      }
      permissions.push(perm);
    }

    const defaultRoles = [
      {
        name: "Admin",
        description: "Full system access with all permissions",
        permissions: permissions.map((p) => p._id),
      },
      {
        name: "Faculty",
        description: "Faculty coordinators with club management permissions",
        permissions: permissions.slice(0, 5).map((p) => p._id),
      },
      {
        name: "Club Leader",
        description: "Club leaders with event and member management permissions",
        permissions: permissions.slice(0, 4).map((p) => p._id),
      },
      {
        name: "Student",
        description: "Regular students with basic permissions",
        permissions: permissions.slice(0, 2).map((p) => p._id),
      },
    ];

    for (const roleData of defaultRoles) {
      let role = await Role.findOne({ name: roleData.name });
      if (!role) {
        role = await Role.create(roleData);
        console.log(`Created role: ${role.name}`);
      }
    }
  } catch (error) {
    console.error("Error creating default roles and permissions:", error.message);
  }
};

// Update club types
async function updateClubTypes() {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.log("MongoDB not connected, skipping club types update");
      return;
    }

    const clubs = await Club.find({ type: { $exists: false } });
    console.log(`Found ${clubs.length} clubs without type field`);

    for (const club of clubs) {
      club.type = "general";
      await club.save();
      console.log(`Updated club ${club.name} with type 'general'`);
    }

    console.log("All clubs updated with type field");
  } catch (error) {
    console.error("Error updating club types:", error);
  }
}

// Create default rewards
const createDefaultRewards = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.log("MongoDB not connected, skipping rewards creation");
      return;
    }

    const defaultRewards = [
      {
        name: 'Club Champion',
        icon: 'fas fa-medal',
        description: 'Awarded for active participation in club activities',
        requiredPoints: 50,
        points: 50,
        category: 'club'
      },
      {
        name: 'Event Enthusiast',
        icon: 'fas fa-calendar-check',
        description: 'Attended 5 or more club events',
        requiredPoints: 100,
        points: 100,
        category: 'event'
      },
      {
        name: 'Team Player',
        icon: 'fas fa-users',
        description: 'Recognized for excellent teamwork in club projects',
        requiredPoints: 80,
        points: 80,
        category: 'achievement'
      },
      {
        name: 'Club Leader',
        icon: 'fas fa-crown',
        description: 'Awarded for leadership in club activities',
        requiredPoints: 150,
        points: 150,
        category: 'club'
      },
      {
        name: 'Event Organizer',
        icon: 'fas fa-clipboard-list',
        description: 'Successfully organized a club event',
        requiredPoints: 120,
        points: 120,
        category: 'event'
      },
      {
        name: 'Rising Star',
        icon: 'fas fa-star',
        description: 'New member with outstanding contributions',
        requiredPoints: 30,
        points: 30,
        category: 'achievement'
      },
      {
        name: 'Mentor',
        icon: 'fas fa-hands-helping',
        description: 'Mentored new club members',
        requiredPoints: 70,
        points: 70,
        category: 'achievement'
      },
      {
        name: 'Innovator',
        icon: 'fas fa-lightbulb',
        description: 'Introduced innovative ideas to the club',
        requiredPoints: 90,
        points: 90,
        category: 'special'
      }
    ];

    for (const rewardData of defaultRewards) {
      let reward = await Reward.findOne({ name: rewardData.name });
      if (!reward) {
        reward = await Reward.create(rewardData);
        console.log(`Created reward: ${reward.name}`);
      }
    }
  } catch (error) {
    console.error("Error creating default rewards:", error.message);
  }
};

// Fix existing club members points
const fixClubMembersPoints = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.log("MongoDB not connected, skipping club members points fix");
      return;
    }

    // Find all users who are club members (have at least one club in their clubs array)
    const clubMembers = await User.find({ 
      clubs: { $exists: true, $ne: [] }
    });

    let updatedCount = 0;

    for (const user of clubMembers) {
      // If the user has less than 10 points, set to 10
      if (user.points < 10) {
        user.points = 10;
        await user.save();
        updatedCount++;
        console.log(`Fixed points for user: ${user.username} (${user.name}) - set to 10 points`);
      }
    }

    console.log(`Club members points fix completed. Updated ${updatedCount} users.`);
  } catch (error) {
    console.error("Error fixing club members points:", error);
  }
};

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, async () => {
  console.log(`KMIT Clubs Hub server running on port ${PORT}`);
  
  // Initialize data
  try {
    await Promise.all([
      createDefaultAdmin(),
      fixUserRoles(),
      createDefaultRolesAndPermissions(),
      updateClubTypes(),
      createDefaultRewards(),
      fixClubMembersPoints()
    ]);
    console.log('Database initialization complete!');
  } catch (error) {
    console.error('Error during initialization:', error);
  }
});

// Attach socket.io to the server
const io = require('socket.io')(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ["GET", "POST"]
  }
});

// Make io accessible to routes
app.set('io', io);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Join a room
  socket.on('join-room', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined room`);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});