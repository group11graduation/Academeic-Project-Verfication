import mongoose from 'mongoose';

const teacherProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    employeeId: { type: String, trim: true, unique: true, sparse: true },
    department: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    skills: [{ type: String, trim: true }],
    photo: { type: String, default: '' },
    /** Class codes this teacher is assigned to (admin workflow); detailed subject links live on Class */
    assignedClassCodes: [{ type: String, trim: true }],
    /** Last plain login passcode (set on create / regenerate / password change) — admin API only; share with user offline */
    handoffPasscode: { type: String, default: '', select: true },
  },
  { timestamps: true }
);

export const TeacherProfile = mongoose.model('TeacherProfile', teacherProfileSchema);
