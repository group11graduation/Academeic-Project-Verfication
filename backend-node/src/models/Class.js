import mongoose from 'mongoose';

const CLASS_CATEGORIES = ['ACADEMIC', 'LAB BASED', 'THEORY', 'WORKSHOP', 'SEMINAR'];

const teacherAssignmentSchema = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
  },
  { _id: false }
);

const classSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    faculty: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' },
    category: { type: String, enum: CLASS_CATEGORIES, default: 'ACADEMIC' },
    academicYear: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear' },
    semester: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester' },
    /** Class-level subjects (course modules available for this class) */
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
    teacherAssignments: [teacherAssignmentSchema],
  },
  { timestamps: true }
);

classSchema.index({ code: 1 }, { unique: true });

export const Class = mongoose.model('Class', classSchema);
export { CLASS_CATEGORIES };
