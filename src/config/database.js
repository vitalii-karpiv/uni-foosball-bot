const mongoose = require('mongoose');

/**
 * Connect to MongoDB Atlas
 */
async function connectToDatabase() {
  try {
    // Ensure dotenv is loaded
    if (!process.env.MONGODB_URI) {
      console.log('🔍 Checking environment variables...');
      console.log('Available env vars:', Object.keys(process.env).filter(key => key.includes('MONGODB') || key.includes('TELEGRAM')));
      
      // Try to load dotenv again if not already loaded
      try {
        require('dotenv').config();
        console.log('📄 Reloaded .env file');
      } catch (dotenvError) {
        console.log('⚠️ Could not reload .env file:', dotenvError.message);
      }
    }
    
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      console.error('❌ MONGODB_URI environment variable is not set');
      console.log('💡 Make sure you have:');
      console.log('   1. Created a .env file from env.example');
      console.log('   2. Set your MongoDB Atlas connection string');
      console.log('   3. The .env file is in the project root directory');
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    console.log('🔗 Connecting to MongoDB...');
    console.log('📊 URI preview:', mongoUri.substring(0, 20) + '...');
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to MongoDB Atlas');
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected');
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('📴 MongoDB connection closed through app termination');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    console.log('🔧 Troubleshooting tips:');
    console.log('   - Check your .env file exists and has MONGODB_URI');
    console.log('   - Verify your MongoDB Atlas connection string');
    console.log('   - Ensure your IP is whitelisted in MongoDB Atlas');
    process.exit(1);
  }
}

/**
 * Disconnect from MongoDB
 */
async function disconnectFromDatabase() {
  try {
    await mongoose.connection.close();
    console.log('📴 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error disconnecting from MongoDB:', error);
  }
}

module.exports = {
  connectToDatabase,
  disconnectFromDatabase
}; 