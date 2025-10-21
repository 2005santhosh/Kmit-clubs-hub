const mongoose = require('mongoose');
const Club = require('./models/Club');
const User = require('./models/User');

// Use the same MongoDB connection string as in your app.js
// Replace with your actual MongoDB connection string
const MONGO_URI = 'mongodb+srv://damerasanthosh2005_db_user:Kmitclubs%402025@cluster0.ztt7orh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const fixClubMembers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Get all clubs
    const clubs = await Club.find({});
    console.log(`Found ${clubs.length} clubs`);

    let totalFixed = 0;

    for (const club of clubs) {
      console.log(`\nProcessing club: ${club.name}`);
      
      const validMembers = [];
      let fixedCount = 0;

      for (const member of club.members) {
        // Check if member has a user reference
        if (!member.user) {
          console.log(`Member without user reference: ${JSON.stringify(member)}`);
          fixedCount++;
          continue;
        }

        // Check if the user reference is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(member.user)) {
          console.log(`Invalid ObjectId: ${member.user}`);
          fixedCount++;
          continue;
        }

        // Check if the user exists
        const user = await User.findById(member.user);
        if (!user) {
          console.log(`User not found for ID: ${member.user}`);
          fixedCount++;
          continue;
        }

        // If we get here, the member reference is valid
        validMembers.push(member);
      }

      // Update the club if we fixed any members
      if (fixedCount > 0) {
        console.log(`Fixed ${fixedCount} invalid members in club: ${club.name}`);
        club.members = validMembers;
        await club.save();
        totalFixed += fixedCount;
      } else {
        console.log(`All members are valid in club: ${club.name}`);
      }
    }

    console.log(`\nTotal fixed members: ${totalFixed}`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

fixClubMembers();