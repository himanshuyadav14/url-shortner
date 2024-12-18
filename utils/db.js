const mongoose = require("mongoose");

async function connectMongoDB(url) {
  try {
    if (!url) throw new Error("MongoDB connection URL is not defined.");
    await mongoose.connect(url);
    console.log("✅ Successfully connected to MongoDB.");
  } catch (error) {
    console.error("❌ Error connecting to MongoDB:", error.message);
    throw error; 
  }
}

module.exports = { connectMongoDB };
