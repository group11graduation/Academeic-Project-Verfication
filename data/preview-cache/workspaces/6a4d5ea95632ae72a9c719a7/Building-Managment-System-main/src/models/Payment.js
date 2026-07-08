const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    building: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Building",
      required: true
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    frequency: {
      type: String,
      enum: ["MONTHLY", "QUARTERLY", "YEARLY"],
      required: true,
      default: "MONTHLY"
    },
    lastPaidDate: {
      type: Date
    },
    nextDueDate: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ["PAID", "PENDING", "OVERDUE"],
      default: "PENDING"
    },
    paymentHistory: [{
      amount: Number,
      paidDate: Date,
      notes: String
    }]
  },
  {
    timestamps: true
  }
);

// Index for efficient queries
paymentSchema.index({ building: 1, manager: 1 });
paymentSchema.index({ nextDueDate: 1, status: 1 });

module.exports = mongoose.model("Payment", paymentSchema);
