// debug-env.js
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file in the project root directory
const envPath = path.join(__dirname, '..', '.env');
console.log('Looking for .env file at:', envPath);

dotenv.config({ path: envPath });

console.log('Environment Variables:');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'DEFINED' : 'NOT DEFINED');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'DEFINED' : 'NOT DEFINED');
console.log('PORT:', process.env.PORT ? 'DEFINED' : 'NOT DEFINED');

if (process.env.MONGODB_URI) {
  console.log('\nMONGODB_URI value:');
  console.log(process.env.MONGODB_URI);
} else {
  console.log('\n.env file contents:');
  const fs = require('fs');
  try {
    const envContents = fs.readFileSync(envPath, 'utf8');
    console.log(envContents);
  } catch (err) {
    console.error('Could not read .env file:', err);
  }
}