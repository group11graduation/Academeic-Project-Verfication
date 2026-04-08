import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: false }
);

const groupSchema = new mongoose.Schema(
  {
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    name: { type: String, trim: true, default: 'Group' },
    leader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [memberSchema],
    locked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

groupSchema.index({ assignment: 1, leader: 1 });

export const Group = mongoose.model('Group', groupSchema);
