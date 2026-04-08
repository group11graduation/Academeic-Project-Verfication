import mongoose from 'mongoose';

const performanceCategorySchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    academicYear: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear' },
    semester: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester' },
    score: { type: Number },
    gpa: { type: Number },
    /** Used later for intelligent grouping bands */
    performanceCategory: {
      type: String,
      enum: ['top', 'middle', 'low', 'unclassified'],
      default: 'unclassified',
    },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

performanceCategorySchema.index({ student: 1, semester: 1 }, { unique: true, sparse: true });

export const StudentPerformanceRecord = mongoose.model('StudentPerformanceRecord', performanceCategorySchema);
