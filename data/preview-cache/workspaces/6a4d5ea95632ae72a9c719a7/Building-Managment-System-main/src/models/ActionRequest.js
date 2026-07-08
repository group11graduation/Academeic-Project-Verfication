const mongoose = require("mongoose");

const actionRequestSchema = new mongoose.Schema(
  {
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    building: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Building",
      required: true
    },

    actionType: {
      type: String,
      enum: ["UPDATE", "DELETE"],
      required: true
    },

    targetType: {
      type: String,
      enum: ["FLOOR", "ROOM", "PERSON"],
      required: true
    },

    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },

    payload: {
      type: Object, // updated data (for UPDATE)
    },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING"
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    reason: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("ActionRequest", actionRequestSchema);
