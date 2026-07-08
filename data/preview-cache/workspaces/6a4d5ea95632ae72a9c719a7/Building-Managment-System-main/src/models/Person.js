const mongoose = require("mongoose");

const personSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ["STAFF", "TENANT"],
    required: [true, "Person type is required"]
  },
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Room"
  },
  building: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Building",
    required: [true, "Building is required"]
  }
}, { timestamps: true });

module.exports = mongoose.model("Person", personSchema);
