const mongoose = require("mongoose");

const floorSchema = new mongoose.Schema({
  floorNumber: {
    type: Number,
    required: [true, "Floor number is required"]
  },
  building: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Building",
    required: [true, "Building is required"]
  }
}, { timestamps: true });

module.exports = mongoose.model("Floor", floorSchema);
