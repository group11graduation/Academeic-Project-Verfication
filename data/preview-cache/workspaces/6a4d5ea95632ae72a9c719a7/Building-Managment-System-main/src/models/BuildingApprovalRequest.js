const mongoose = require("mongoose");

const buildingApprovalRequestSchema = new mongoose.Schema(
  {
    buildingData: {
      type: Object, // All building data (name, location, managerId, etc.)
      required: true
    },
    
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    approvalPolicy: {
      type: String,
      enum: ["MANAGER_ONLY", "BOTH"],
      required: true
    },

    managerApproved: {
      type: Boolean,
      default: false
    },

    managerApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    adminApproved: {
      type: Boolean,
      default: false
    },

    adminApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING"
    },

    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    reason: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("BuildingApprovalRequest", buildingApprovalRequestSchema);
