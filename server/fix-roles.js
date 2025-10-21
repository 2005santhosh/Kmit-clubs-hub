// fix-roles.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

// Connect to MongoDB with the same connection string as your server
const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kmit-clubs-hub';

console.log('Connecting to MongoDB:', mongoURI);

mongoose.connect(mongoURI)
  .then(() => {
    console.log('MongoDB connected successfully');
    fixRoles();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const fixRoles = async () => {
  try {
    console.log('Starting role fix...');
    
    // Get all users
    const users = await User.find({});
    console.log(`Found ${users.length} users`);
    
    if (users.length === 0) {
      console.log('No users found in the database. Creating default admin...');
      
      // Create default admin if no users exist
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('Kmit123@', salt);
      
      const admin = new User({
        username: 'deepa@kmit',
        password: hashedPassword,
        name: 'Deepa Admin',
        systemRole: 'admin',
        role: 'admin'
      });
      
      await admin.save();
      console.log('Created default admin: deepa@kmit / Kmit123@');
      
      // Fetch users again
      const usersAfter = await User.find({});
      console.log(`Now found ${usersAfter.length} users`);
      
      // Process the new admin
      for (const user of usersAfter) {
        console.log(`Processing user: ${user.username}`);
        console.log(`  Current role: ${user.role}`);
        console.log(`  Current systemRole: ${user.systemRole}`);
        
        // If systemRole is not set, copy from role
        if (!user.systemRole) {
          user.systemRole = user.role || 'student';
          console.log(`  Set systemRole to: ${user.systemRole}`);
        }
        
        // If role is not set, copy from systemRole
        if (!user.role) {
          user.role = user.systemRole || 'student';
          console.log(`  Set role to: ${user.role}`);
        }
        
        // Make sure both are set to the same value
        if (user.systemRole !== user.role) {
          console.log(`  Mismatch: role=${user.role}, systemRole=${user.systemRole}`);
          user.role = user.systemRole;
          console.log(`  Fixed: both set to ${user.role}`);
        }
        
        await user.save();
        console.log(`  Saved user: ${user.username}`);
      }
    } else {
      // Process existing users
      for (const user of users) {
        console.log(`Processing user: ${user.username}`);
        console.log(`  Current role: ${user.role}`);
        console.log(`  Current systemRole: ${user.systemRole}`);
        
        // If systemRole is not set, copy from role
        if (!user.systemRole) {
          user.systemRole = user.role || 'student';
          console.log(`  Set systemRole to: ${user.systemRole}`);
        }
        
        // If role is not set, copy from systemRole
        if (!user.role) {
          user.role = user.systemRole || 'student';
          console.log(`  Set role to: ${user.role}`);
        }
        
        // Make sure both are set to the same value
        if (user.systemRole !== user.role) {
          console.log(`  Mismatch: role=${user.role}, systemRole=${user.systemRole}`);
          user.role = user.systemRole;
          console.log(`  Fixed: both set to ${user.role}`);
        }
        
        await user.save();
        console.log(`  Saved user: ${user.username}`);
      }
    }
    
    console.log('Role fix completed');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing roles:', error);
    process.exit(1);
  }
};