import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: false }
);

const groupSchema = new mongoose.Schema(
  {
    /**
     * Assignment-bound group (student work). Mutually exclusive with hostClass.
     * When null, this row is a class-level team template created before any assignment exists.
     */
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', default: null },
    /** Class-level template (no assignment yet). Mutually exclusive with assignment. */
    hostClass: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
    name: { type: String, trim: true, default: 'Group' },
    leader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [memberSchema],
    locked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

groupSchema.pre('validate', function validateAssignmentOrHost(next) {
  const hasAssignment = this.assignment != null;
  const hasHost = this.hostClass != null;
  if (hasAssignment === hasHost) {
    next(new Error('Group must have exactly one of assignment or hostClass'));
    return;
  }
  next();
});

groupSchema.index({ assignment: 1, leader: 1 });
groupSchema.index({ hostClass: 1 });

export const Group = mongoose.model('Group', groupSchema);
