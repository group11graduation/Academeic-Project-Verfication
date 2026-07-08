const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  roomNumber: {
    type: String,
    required: [true, "Room number is required"],
    trim: true
  },
  type: {
    type: String,
    required: [true, "Room type is required"],
    trim: true
  },
  capacity: {
    type: Number,
    min: [1, "Capacity must be at least 1"]
  },
  status: {
    type: String,
    enum: ["AVAILABLE", "OCCUPIED", "MAINTENANCE", "UNAVAILABLE"],
    default: "AVAILABLE"
  },
  payment: {
    amount: {
      type: Number,
      default: 0
    },
    frequency: {
      type: String,
      enum: ["MONTHLY", "QUARTERLY", "YEARLY", "ONE_TIME"],
      default: "MONTHLY"
    },
    currency: {
      type: String,
      default: "USD"
    }
  },
  floor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Floor",
    required: [true, "Floor is required"]
  },
  building: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Building"
  },
  // For apartment structure: parent apartment can have child rooms
  parentApartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Room", // Self-reference for apartment hierarchy
    default: null
  },
  isApartment: {
    type: Boolean,
    default: false
  },
  // For tracking individual room payments within an apartment
  paymentTracking: {
    type: String,
    enum: ["APARTMENT_LEVEL", "ROOM_LEVEL"],
    default: "ROOM_LEVEL" // Default: each room has its own payment
  }
}, { timestamps: true });

module.exports = mongoose.model("Room", roomSchema);
