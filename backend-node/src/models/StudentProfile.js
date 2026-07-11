import mongoose from 'mongoose';

const personalInfoSchema = new mongoose.Schema(
  {
    phone: { type: String, trim: true, default: '' },
    dob: { type: Date, default: null },
    gender: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const parentDetailsSchema = new mongoose.Schema(
  {
    fatherName: { type: String, trim: true, default: '' },
    fatherContact: { type: String, trim: true, default: '' },
    motherName: { type: String, trim: true, default: '' },
    motherContact: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const educationalBackgroundSchema = new mongoose.Schema(
  {
    highSchoolName: { type: String, trim: true, default: '' },
    graduationYear: { type: String, trim: true, default: '' },
    certificateUrl: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const studentProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    studentId: { type: String, trim: true, unique: true, sparse: true },
    program: { type: String, trim: true, default: '' },
    /** Class code (e.g. CS401) for directory / import */
    classCode: { type: String, trim: true, default: '' },
    faculty: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' },
    campus: { type: String, trim: true, default: '' },
    studyMode: { type: String, trim: true, default: '' },
    entryDate: { type: Date, default: null },
    personalInfo: { type: personalInfoSchema, default: () => ({}) },
    parentDetails: { type: parentDetailsSchema, default: () => ({}) },
    educationalBackground: { type: educationalBackgroundSchema, default: () => ({}) },
    /** Latest academic summary (also mirrored from imports / admin edits) */
    currentScore: { type: Number },
    currentGpa: { type: Number },
    /** Last plain login passcode for handoff to student (create / import / regenerate) — admin API only */
    handoffPasscode: { type: String, default: '', select: true },
  },
  { timestamps: true }
);

export const StudentProfile = mongoose.model('StudentProfile', studentProfileSchema);
