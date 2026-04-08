import mongoose from 'mongoose';

/** Approved projects from past semesters — used for similarity warnings, not auto-reject */
const legacyProjectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    proposalDescription: { type: String, default: '' },
    features: [{ type: String }],
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    semester: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester' },
    academicYear: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear' },
    ownerLabel: { type: String, default: '' },
    screenshots: [{ type: String }],
    approvedAt: { type: Date },
  },
  { timestamps: true }
);

legacyProjectSchema.index({ subject: 1, class: 1 });

export const LegacyProject = mongoose.model('LegacyProject', legacyProjectSchema);
