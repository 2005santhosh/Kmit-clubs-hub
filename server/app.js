const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const clubRoutes = require('./routes/clubs');
const userRoutes = require('./routes/users');

const app = express();

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// CORS
app.use(cors());

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/auth', authRoutes); 
app.use('/api/clubs', clubRoutes);
app.use('/api/users', userRoutes);

// Serve HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

app.get('/clubs', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/clubs.html'));
});

app.get('/system-settings', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/system-settings.html'));
});

// Role-based dashboard redirects
app.get('/student_dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/student_dashboard.html'));
});

app.get('/club_leader_dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/club_leader_dashboard.html'));
});

app.get('/faculty_dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/faculty_dashboard.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Create default admin if not exists
const User = require('./models/User');
const mongoose = require('mongoose');

const createDefaultAdmin = async () => {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      console.log('MongoDB not connected, skipping admin creation');
      return;
    }
    
    const adminExists = await User.findOne({ username: 'deepa@kmit' });
    
    if (!adminExists) {
      await User.create({
        username: 'deepa@kmit',
        password: 'Kmit123@', // Admin password as specified
        role: 'admin',
        name: 'Deepa Admin',
      });
      console.log('Default admin created');
    } else {
      console.log('Default admin already exists');
    }
  } catch (error) {
    console.error('Error creating default admin:', error.message);
  }
};

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`KMIT Clubs Hub server running on port ${PORT}`);
  
  // Wait a bit for MongoDB to connect before creating the admin
  setTimeout(createDefaultAdmin, 2000);
});