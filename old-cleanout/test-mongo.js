import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load .env file
dotenv.config();

console.log('MONGO_DB_URI:', process.env.MONGO_DB_URI ? 'Available' : 'Not available');

if (!process.env.MONGO_DB_URI) {
  console.error('MongoDB URI is not set in environment variables');
  process.exit(1);
}

mongoose.connect(process.env.MONGO_DB_URI)
  .then(() => {
    console.log('MongoDB connection successful');
    process.exit(0);
  })
  .catch(err => {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  });