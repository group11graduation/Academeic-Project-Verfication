const mongoose = require("mongoose");

const buildingSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    brandingName: {
      type: String,
      default: ""
    },
    brandingLogo: {
      type: String,
      default: ""
    },
    location: {
      type: String,
      required: true
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    // Approval policy for critical actions
    approvalPolicy: {
      type: String,
      enum: ["MANAGER_ONLY", "MANAGER_AND_SUB", "BOTH"],
      default: "MANAGER_ONLY"
    },
    floorLimit: {
      type: Number,
      default: 0
    },
    allowedRoomTypes: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true // Automatically adds createdAt and updatedAt
  }
);

module.exports = mongoose.model("Building", buildingSchema);
