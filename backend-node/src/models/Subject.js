import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    faculty: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' },
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
