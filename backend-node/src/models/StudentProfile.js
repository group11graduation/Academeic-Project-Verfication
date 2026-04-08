import mongoose from 'mongoose';

const studentProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    studentId: { type: String, trim: true, unique: true, sparse: true },
    program: { type: String, trim: true, default: '' },
    /** Class code (e.g. CS401) for directory / import */
    classCode: { type: String, trim: true, default: '' },
    faculty: { type: String, trim: true, default: '' },
    /** Latest academic summary (also mirrored from imports / admin edits) */
    currentScore: { type: Number },
    currentGpa: { type: Number },
    /** Last plain login passcode for handoff to student (create / import / regenerate) — admin API only */
    handoffPasscode: { type: String, default: '', select: true },
  },
  { timestamps: true }
);

export const StudentProfile = mongoose.model('StudentProfile', studentProfileSchema);
