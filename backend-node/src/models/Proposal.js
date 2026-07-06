import mongoose from 'mongoose';

export const PROPOSAL_STATUSES = [
  'draft',
  'submitted',
  'requirements_rejected',
  'ai_rejected_same_semester',
  'ai_flagged_previous_semester',
  'revision_required',
  'pending_teacher_approval',
  'teacher_approved',
  'teacher_rejected',
];

const collaborativeReviewSchema = new mongoose.Schema(
  {
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, enum: ['approve', 'reject', 'revision'], default: null },
    comment: { type: String, default: '' },
    teacherProposalScore: { type: Number, min: 0, default: null },
    teacherProposalScoreMax: { type: Number, min: 1, default: 100 },
    teacherVsAi: {
      type: String,
      enum: ['not_set', 'aligns', 'stricter', 'lenient'],
      default: 'not_set',
    },
    reviewedAt: { type: Date },
  },
  { _id: false }
);

const proposalSchema = new mongoose.Schema(
  {
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    /** Set when submissionMode is group */
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    features: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: PROPOSAL_STATUSES,
      default: 'draft',
    },
    /** AI analysis snapshot */
    aiSameSemesterMaxScore: { type: Number },
    aiPreviousSemesterMaxScore: { type: Number },
    aiMatchedProposalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Proposal' },
    aiMatchedLegacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'LegacyProject' },
    aiSummary: { type: String, default: '' },
    /** Optional feature hints when flagged as similar to a previous-semester project */
    aiRecommendationText: { type: String, default: '' },
    aiSuggestedFeatures: [{ type: String, trim: true }],
    /** Requirement pre-check snapshot (runs before AI similarity checks) */
    requirementCheckPassed: { type: Boolean, default: true },
    requirementCheckSummary: { type: String, default: '' },
    requirementMissingKeywords: [{ type: String }],
    requirementAllowedTechMatched: [{ type: String }],
    /** After previous-semester warning: student must add features before resubmit */
    requiredNewFeaturesCount: { type: Number, default: 0 },
    /** Snapshot when AI flagged previous-semester match (for diff on resubmit) */
    previousFeaturesAtFlag: [{ type: String }],
    teacherComment: { type: String, default: '' },
    /** Teacher quality score (points earned; see teacherProposalScoreMax for total) */
    teacherProposalScore: { type: Number, min: 0, default: null },
    teacherProposalScoreMax: { type: Number, min: 1, default: 100 },
    /**
     * How the teacher's judgment relates to the AI similarity signals.
     * `aligns` = agrees with the AI risk picture; stricter/lenient = teacher overrides the hint.
     */
    teacherVsAi: {
      type: String,
      enum: ['not_set', 'aligns', 'stricter', 'lenient'],
      default: 'not_set',
    },
    /** Dual-teacher collaborative assignment reviews (frontend + backend teachers) */
    collaborativeTeacherReviews: {
      frontend: { type: collaborativeReviewSchema, default: () => ({}) },
      backend: { type: collaborativeReviewSchema, default: () => ({}) },
    },
    submittedAt: { type: Date },
  },
  { timestamps: true }
);

proposalSchema.index({ assignment: 1, group: 1 });
proposalSchema.index({ assignment: 1, submittedBy: 1 });

export const Proposal = mongoose.model('Proposal', proposalSchema);
