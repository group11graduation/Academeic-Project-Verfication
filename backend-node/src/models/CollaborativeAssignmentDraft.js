import mongoose from 'mongoose';

const techRequirementBlockSchema = new mongoose.Schema(
  {
    requirementText: { type: String, default: '' },
    requiredKeywords: [{ type: String, trim: true }],
    allowedTechnologies: [{ type: String, trim: true }],
    description: { type: String, default: '' },
    requirementFile: { type: String, default: '' },
    originalFileName: { type: String, default: '' },
  },
  { _id: false }
);

const collaborativeAssignmentDraftSchema = new mongoose.Schema(
  {
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    coTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    frontendTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    backendTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
    classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
    frontendSubject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
    backendSubject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
    semester: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', default: null },
    academicYear: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', default: null },
    title: { type: String, default: '', trim: true },
    description: { type: String, default: '' },
    submissionMode: { type: String, enum: ['single', 'group'], default: 'single' },
    proposalDeadline: { type: Date, default: null },
    projectDeadline: { type: Date, default: null },
    frontendTechRequirements: { type: techRequirementBlockSchema, default: () => ({}) },
    backendTechRequirements: { type: techRequirementBlockSchema, default: () => ({}) },
    frontendSectionComplete: { type: Boolean, default: false },
    backendSectionComplete: { type: Boolean, default: false },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    publishedAssignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', default: null },
  },
  { timestamps: true }
);

collaborativeAssignmentDraftSchema.index({ initiatedBy: 1, status: 1 });
collaborativeAssignmentDraftSchema.index({ coTeacherId: 1, status: 1 });
collaborativeAssignmentDraftSchema.index({ frontendTeacherId: 1, status: 1 });
collaborativeAssignmentDraftSchema.index({ backendTeacherId: 1, status: 1 });

export const CollaborativeAssignmentDraft = mongoose.model(
  'CollaborativeAssignmentDraft',
  collaborativeAssignmentDraftSchema
);
