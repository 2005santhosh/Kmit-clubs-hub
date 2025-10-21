// fix-club-leaders.js
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

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    fixClubLeaders();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const fixClubLeaders = async () => {
  try {
    console.log('Fixing club leaders...');
    
    // Find all users with systemRole 'clubLeader'
    const clubLeaders = await User.find({ systemRole: 'clubLeader' });
    console.log(`Found ${clubLeaders.length} users with systemRole 'clubLeader'`);
    
    for (const leader of clubLeaders) {
      console.log(`Processing club leader: ${leader.username}`);
      console.log(`  Current role: ${leader.role}`);
      console.log(`  Current systemRole: ${leader.systemRole}`);
      
      // Ensure role is also set to clubLeader
      if (leader.role !== 'clubLeader') {
        leader.role = 'clubLeader';
        await leader.save();
        console.log(`  Fixed role to: ${leader.role}`);
      } else {
        console.log(`  Role already correct`);
      }
    }
    
    // Also find users with role 'clubLeader' but systemRole not set correctly
    const clubLeadersByRole = await User.find({ role: 'clubLeader', systemRole: { $ne: 'clubLeader' } });
    console.log(`Found ${clubLeadersByRole.length} users with role 'clubLeader' but incorrect systemRole`);
    
    for (const leader of clubLeadersByRole) {
      console.log(`Processing club leader (by role): ${leader.username}`);
      console.log(`  Current role: ${leader.role}`);
      console.log(`  Current systemRole: ${leader.systemRole}`);
      
      // Fix systemRole
      leader.systemRole = 'clubLeader';
      await leader.save();
      console.log(`  Fixed systemRole to: ${leader.systemRole}`);
    }
    
    console.log('Club leaders fix completed');
    
    // List all club leaders
    const allClubLeaders = await User.find({ 
      $or: [
        { systemRole: 'clubLeader' },
        { role: 'clubLeader' }
      ]
    });
    
    console.log('\nAll club leaders in database:');
    for (const leader of allClubLeaders) {
      console.log(`- ${leader.username} (${leader.name}): role=${leader.role}, systemRole=${leader.systemRole}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error fixing club leaders:', error);
    process.exit(1);
  }
};

// Connect to MongoDB and run the fix
connectDB();