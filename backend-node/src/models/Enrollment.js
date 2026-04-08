import mongoose from 'mongoose';

const enrollmentSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    academicYear: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear' },
    semester: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester' },
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
    status: {
      type: String,
      enum: ['active', 'completed', 'withdrawn'],
      default: 'active',
    },
  },
  { timestamps: true }
);

enrollmentSchema.index({ student: 1, class: 1, semester: 1 }, { unique: true, sparse: true });

export const Enrollment = mongoose.model('Enrollment', enrollmentSchema);
