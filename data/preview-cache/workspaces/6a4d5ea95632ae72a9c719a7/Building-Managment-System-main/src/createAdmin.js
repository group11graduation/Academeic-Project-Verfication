require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("./models/User");
const connectDB = require("./config/db");

const createAdmin = async () => {
  await connectDB();

  const existing = await User.findOne({ email: "aminaisaleh124@gmail.com" });
  if (existing) {
    console.log("Admin already exists");
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash("1234", 10);

  const admin = new User({
    name: "Super Admin",
    email: "aminaisaleh124@gmail.com",
    password: hashedPassword,
    role: "SUPER_ADMIN"
  });

  await admin.save();
  console.log("Super Admin created");
  process.exit(0);
};

createAdmin();
