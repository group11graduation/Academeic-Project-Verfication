import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = [
  'proposal_submitted',
  'proposal_reviewed',
  'proposal_ai_result',
  'project_uploaded',
  'message_received',
  'message_replied',
  'assignment_created',
  'system',
];

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      default: 'system',
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, default: '', trim: true, maxlength: 1000 },
    link: { type: String, default: '', trim: true, maxlength: 500 },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
