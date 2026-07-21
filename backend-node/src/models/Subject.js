import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    /** Primary faculty (first of `faculties`) — kept for older readers. */
    faculty: { type: String, trim: true, default: '' },
    /** Primary department (first of `departments`) — kept for older readers. */
    department: { type: String, trim: true, default: '' },
    /** Faculties that offer / teach this subject. */
    faculties: { type: [String], default: [] },
    /** Departments that offer / teach this subject. */
    departments: { type: [String], default: [] },
    /** frontend | backend — used to pair teachers for collaborative assignments */
    collaborationSide: {
      type: String,
      enum: ['', 'frontend', 'backend'],
      default: '',
    },
  },
  { timestamps: true }
);

subjectSchema.index({ code: 1 }, { unique: true });

export const Subject = mongoose.model('Subject', subjectSchema);
