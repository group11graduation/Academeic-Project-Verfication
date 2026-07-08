// src/models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"]
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: [6, "Password must be at least 6 characters"]
  },

  role: {
    type: String,
    enum: ["SUPER_ADMIN", "MANAGER", "SUB_MANAGER"],
    required: true
  },

  phone: {
    type: String,
    trim: true
  },

  buildingLogo: {
    type: String,
    default: ""
  },

  paymentDetails: {
    type: Object, 
    default: {}
  },

  sections: {
    type: [String],
    default: []
  },

  building: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Building",
  },

  parentManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  adminPerson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "AdminPerson"
  }

}, { timestamps: true });

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

module.exports = mongoose.model("User", userSchema);
