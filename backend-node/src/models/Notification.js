import mongoose from 'mongoose';

/**
 * Granular event types (used by existing workflows) plus high-level
 * categories for the dual notification helper (ASSIGNMENT | PROPOSAL | SYSTEM).
 */
export const NOTIFICATION_TYPES = [
  'ASSIGNMENT',
  'PROPOSAL',
  'SYSTEM',
  'proposal_submitted',
  'proposal_reviewed',
  'proposal_ai_result',
  'project_uploaded',
  'project_reviewed',
  'message_received',
  'message_replied',
  'assignment_created',
  'system',
];

const notificationSchema = new mongoose.Schema(
  {
    /** Recipient user (ObjectId). Stored as `user` for existing API/clients. */
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      default: 'SYSTEM',
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    /** Message body (stored as `body`; `message` virtual aliases below). */
    body: { type: String, default: '', trim: true, maxlength: 1000 },
    link: { type: String, default: '', trim: true, maxlength: 500 },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    /** Preferred read flag; kept in sync with `readAt` for dual-system clients. */
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/** Aliases matching the dual-notification API naming. */
notificationSchema.virtual('recipient').get(function recipientVirtual() {
  return this.user;
});

notificationSchema.virtual('message').get(function messageVirtual() {
  return this.body;
});

notificationSchema.pre('save', function syncReadState(next) {
  if (this.isModified('isRead')) {
    if (this.isRead && !this.readAt) this.readAt = new Date();
    if (!this.isRead) this.readAt = null;
  } else if (this.isModified('readAt')) {
    this.isRead = Boolean(this.readAt);
  }
  next();
});

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
