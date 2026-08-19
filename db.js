const mongoose = require('mongoose');
require('dotenv').config();

let memMongoInstance = null;

async function connectDB() {
  const envUri = process.env.MONGODB_URI;

  // Tier 1: Check if custom MONGODB_URI is provided in .env (e.g. MongoDB Atlas Cloud)
  if (envUri && envUri.trim() !== '' && !envUri.includes('127.0.0.1') && !envUri.includes('localhost')) {
    try {
      console.log(`☁️ Connecting to Cloud MongoDB Atlas URI...`);
      const conn = await mongoose.connect(envUri, { serverSelectionTimeoutMS: 6000 });
      console.log(`✅ Connected to Cloud MongoDB Atlas: ${conn.connection.host} / ${conn.connection.name}`);
      return conn;
    } catch (err) {
      console.warn(`⚠️ Cloud MongoDB connection failed (${err.message}). Trying local fallback...`);
    }
  }

  // Tier 2: Try local standalone MongoDB instance (mongodb://127.0.0.1:27017/location_tracker)
  const localUri = 'mongodb://127.0.0.1:27017/location_tracker';
  try {
    const conn = await mongoose.connect(localUri, { serverSelectionTimeoutMS: 2000 });
    console.log(`💻 Connected to standalone Local MongoDB server: ${conn.connection.host} / ${conn.connection.name}`);
    return conn;
  } catch (err) {
    // Standalone local mongod service is not running
  }

  // Tier 3: Zero-Setup Embedded MongoDB (Auto-starts background MongoDB process via Node)
  try {
    console.log(`⚡ Standalone MongoDB not detected. Auto-launching Zero-Setup Embedded MongoDB...`);
    const { MongoMemoryServer } = require('mongodb-memory-server');

    memMongoInstance = await MongoMemoryServer.create({
      instance: {
        dbName: 'location_tracker'
      }
    });

    const memoryUri = memMongoInstance.getUri();
    const conn = await mongoose.connect(memoryUri);
    console.log(`🚀 Embedded MongoDB active & connected! Anyone can run this project out-of-the-box.`);
    return conn;
  } catch (err) {
    console.error(`⚠️ Failed to start Embedded MongoDB: ${err.message}`);
    throw err;
  }
}

async function disconnectDB() {
  await mongoose.disconnect();
  if (memMongoInstance) {
    await memMongoInstance.stop();
  }
}

module.exports = { connectDB, disconnectDB };
