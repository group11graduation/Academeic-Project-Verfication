import mongoose from 'mongoose';

/**
 * Heart / love reactions on verified gallery projects.
 * projectKey is the public gallery id (proposal ObjectId string or legacy-<id>).
 */
const galleryReactionSchema = new mongoose.Schema(
  {
    projectKey: { type: String, required: true, trim: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

galleryReactionSchema.index({ projectKey: 1, user: 1 }, { unique: true });

export const GalleryReaction = mongoose.model('GalleryReaction', galleryReactionSchema);
