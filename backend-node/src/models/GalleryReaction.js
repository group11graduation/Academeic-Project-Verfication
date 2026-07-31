import mongoose from 'mongoose';

/**
 * Heart / love reactions on verified gallery projects.
 * projectKey is the public gallery id (proposal ObjectId string or legacy-<id>).
 * Signed-in users use `user`; anonymous visitors use `guestKey` (browser id).
 */
const galleryReactionSchema = new mongoose.Schema(
  {
    projectKey: { type: String, required: true, trim: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    guestKey: { type: String, default: '', trim: true, index: true },
    displayName: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

galleryReactionSchema.index(
  { projectKey: 1, user: 1 },
  { unique: true, partialFilterExpression: { user: { $type: 'objectId' } } }
);
galleryReactionSchema.index(
  { projectKey: 1, guestKey: 1 },
  { unique: true, partialFilterExpression: { guestKey: { $gt: '' } } }
);

export const GalleryReaction = mongoose.model('GalleryReaction', galleryReactionSchema);
