// Environment variable validation
require("dotenv").config();

const requiredEnvVars = [
  "MONGO_URI",
  "JWT_SECRET"
];

const validateEnv = () => {
  const missing = [];

  requiredEnvVars.forEach((varName) => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach((varName) => {
      console.error(`   - ${varName}`);
    });
    console.error("\nPlease create a .env file with the required variables.");
    process.exit(1);
  }

  // Validate MONGO_URI format
  if (process.env.MONGO_URI && !process.env.MONGO_URI.startsWith("mongodb")) {
    console.error("❌ MONGO_URI must start with 'mongodb://' or 'mongodb+srv://'");
    process.exit(1);
  }

  // Validate JWT_SECRET length
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.warn("⚠️  JWT_SECRET should be at least 32 characters long for security");
  }

  console.log("✅ Environment variables validated");
};

module.exports = validateEnv;
