const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dropEmailIndex = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI is not defined in the environment variables');
      process.exit(1);
    }
    
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    // Get the users collection
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    // Check if email index exists
    const indexes = await usersCollection.indexes();
    const emailIndexExists = indexes.some(index => index.key.email === 1);
    
    if (emailIndexExists) {
      // Drop the email index
      await usersCollection.dropIndex('email_1');
      console.log('Email index dropped successfully');
    } else {
      console.log('Email index does not exist, no action needed');
    }
    
    mongoose.connection.close();
    console.log('Connection closed');
  } catch (error) {
    console.error('Error dropping email index:', error.message);
    process.exit(1);
  }
};

dropEmailIndex();