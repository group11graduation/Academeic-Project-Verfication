import mongoose from 'mongoose';

const semesterSchema = new mongoose.Schema(
  {
    academicYear: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    startDate: { type: Date },
    endDate: { type: Date },
  },
  { timestamps: true }
);

semesterSchema.index({ academicYear: 1, name: 1 }, { unique: true });

export const Semester = mongoose.model('Semester', semesterSchema);
