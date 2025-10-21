// create-test-users.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
const envPath = path.join(__dirname, '.env');
dotenv.config({ path: envPath });

// Check if MONGODB_URI is loaded
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not defined in .env file');
  console.error('Current .env path:', envPath);
  process.exit(1);
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    createTestUsers();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const createTestUsers = async () => {
  try {
    console.log('Creating test users...');
    
    // Hash password for test users (using Kmit123@)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Kmit123@', salt);
    
    // Create test admin
    const testAdminExists = await User.findOne({ username: 'admin@test.com' });
    if (!testAdminExists) {
      await User.create({
        username: 'admin@test.com',
        password: hashedPassword,
        name: 'Test Admin',
        systemRole: 'admin',
        role: 'admin'
      });
      console.log('Created test admin: admin@test.com / Kmit123@');
    } else {
      console.log('Test admin already exists');
    }
    
    // Create test faculty
    const testFacultyExists = await User.findOne({ username: 'faculty@test.com' });
    if (!testFacultyExists) {
      await User.create({
        username: 'faculty@test.com',
        password: hashedPassword,
        name: 'Test Faculty',
        systemRole: 'faculty',
        role: 'faculty'
      });
      console.log('Created test faculty: faculty@test.com / Kmit123@');
    } else {
      console.log('Test faculty already exists');
    }
    
    // Create test club leader
    const testClubLeaderExists = await User.findOne({ username: 'leader@test.com' });
    if (!testClubLeaderExists) {
      await User.create({
        username: 'leader@test.com',
        password: hashedPassword,
        name: 'Test Club Leader',
        systemRole: 'clubLeader',
        role: 'clubLeader'
      });
      console.log('Created test club leader: leader@test.com / Kmit123@');
    } else {
      console.log('Test club leader already exists');
    }
    
    // Create test student
    const testStudentExists = await User.findOne({ username: 'student@test.com' });
    if (!testStudentExists) {
      await User.create({
        username: 'student@test.com',
        password: hashedPassword,
        name: 'Test Student',
        systemRole: 'student',
        role: 'student'
      });
      console.log('Created test student: student@test.com / Kmit123@');
    } else {
      console.log('Test student already exists');
    }
    
    console.log('Test users creation completed');
    
    // List all users
    const allUsers = await User.find({});
    console.log('\nAll users in database:');
    allUsers.forEach(user => {
      console.log(`- ${user.username} (${user.name}): role=${user.role}, systemRole=${user.systemRole}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating test users:', error);
    process.exit(1);
  }
};

// Connect to MongoDB and run the creation
connectDB();