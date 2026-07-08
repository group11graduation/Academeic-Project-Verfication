const mongoose = require("mongoose");

/**
 * RoomPayment Model - Tracks actual payments made by tenants for rooms
 * This is separate from the Payment model which tracks building-level payments (manager to admin)
 */
const roomPaymentSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true
    },
    person: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Person",
      required: true
    },
    building: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Building",
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: "USD"
    },
    paymentDate: {
      type: Date,
      default: Date.now
    },
    dueDate: {
      type: Date,
      required: true
    },
    period: {
      type: String, // e.g., "2024-01", "2024-Q1", "2024"
      required: true
    },
    frequency: {
      type: String,
      enum: ["MONTHLY", "QUARTERLY", "YEARLY", "ONE_TIME"],
      required: true,
      default: "MONTHLY"
    },
    status: {
      type: String,
      enum: ["PAID", "PENDING", "OVERDUE", "PARTIAL"],
      default: "PENDING"
    },
    paidAmount: {
      type: Number,
      default: 0
    },
    paidDate: {
      type: Date
    },
    notes: {
      type: String
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "BANK_TRANSFER", "CHECK", "CARD", "OTHER"],
      default: "CASH"
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes for efficient queries
roomPaymentSchema.index({ room: 1, person: 1, period: 1 });
roomPaymentSchema.index({ building: 1, status: 1 });
roomPaymentSchema.index({ dueDate: 1, status: 1 });
roomPaymentSchema.index({ person: 1, status: 1 });

module.exports = mongoose.model("RoomPayment", roomPaymentSchema);
