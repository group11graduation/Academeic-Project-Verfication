const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      // Connection options for better reliability
      bufferCommands: false, // Disable mongoose buffering
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    });
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    if (process.env.PREVIEW_SANDBOX === '1') {
    console.warn('[preview] MongoDB unavailable — API stays up; ensure MongoDB runs on the host (port 27017)');
    return;
  }
  process.exit(1);
  }
};

module.exports = connectDB;
