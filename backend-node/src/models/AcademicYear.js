import mongoose from 'mongoose';

const academicYearSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    startDate: { type: Date },
    endDate: { type: Date },
    isCurrent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

academicYearSchema.index({ label: 1 }, { unique: true });

export const AcademicYear = mongoose.model('AcademicYear', academicYearSchema);
