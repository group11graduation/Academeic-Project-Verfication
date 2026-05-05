import mongoose from 'mongoose';

const SUBMISSION_MODES = ['single', 'group'];
const GROUP_MODE_TYPES = ['teacher_manual', 'automatic', 'student_self_select'];
const ASSIGNMENT_TYPES = ['normal', 'final'];
const CLASS_ASSIGNMENT_MODES = ['single', 'multiple'];

const assignmentSchema = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    semester: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', required: true },
    academicYear: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    /** Teacher-defined project requirements text */
    requirementText: { type: String, default: '' },
    /** Optional structured requirement hints used in pre-check gate */
    requiredKeywords: [{ type: String, trim: true }],
    allowedTechnologies: [{ type: String, trim: true }],
    /** Optional teacher-uploaded requirements file */
    assignmentFile: { type: String, default: '' },
    originalFileName: { type: String, default: '' },
    assignmentType: { type: String, enum: ASSIGNMENT_TYPES, default: 'normal' },
    classAssignmentMode: { type: String, enum: CLASS_ASSIGNMENT_MODES, default: 'single' },
    submissionMode: { type: String, enum: SUBMISSION_MODES, default: 'single' },
    groupModeType: {
      type: String,
      enum: GROUP_MODE_TYPES,
      default: 'teacher_manual',
    },
    maxGroupSize: { type: Number, default: 4, min: 2, max: 20 },
    proposalPhaseOpen: { type: Boolean, default: true },
    projectPhaseOpen: { type: Boolean, default: false },
    proposalDeadline: { type: Date },
    projectDeadline: { type: Date },
    /** When false, only leader may submit proposal/project in group mode */
    allowMemberVisibility: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

assignmentSchema.index({ teacher: 1, class: 1, subject: 1, semester: 1 });
assignmentSchema.index({ teacher: 1, classes: 1, subject: 1, semester: 1 });

export const Assignment = mongoose.model('Assignment', assignmentSchema);
export { SUBMISSION_MODES, GROUP_MODE_TYPES, ASSIGNMENT_TYPES, CLASS_ASSIGNMENT_MODES };
