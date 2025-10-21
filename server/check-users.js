// check-users.js
const mongoose = require('mongoose');
const User = require('./models/User');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file in the project root directory
const envPath = path.join(__dirname, '..', '.env');
console.log('Looking for .env file at:', envPath);
dotenv.config({ path: envPath });

// Check if MONGODB_URI is loaded
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not defined in .env file');
  console.error('Current .env path:', envPath);
  process.exit(1);
}

console.log('MONGODB_URI:', process.env.MONGODB_URI);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    checkUsers();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const checkUsers = async () => {
  try {
    console.log('Checking all users...');
    
    // Get all users
    const users = await User.find({});
    console.log(`Found ${users.length} users`);
    
    console.log('\nUser details:');
    for (const user of users) {
      console.log(`\n- Username: ${user.username}`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  System Role: ${user.systemRole}`);
      console.log(`  Club Role: ${user.clubRole}`);
      console.log(`  Club: ${user.club ? user.club : 'None'}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking users:', error);
    process.exit(1);
  }
};

// Connect to MongoDB and run the check
connectDB();