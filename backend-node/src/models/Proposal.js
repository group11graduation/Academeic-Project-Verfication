import mongoose from 'mongoose';

export const PROPOSAL_STATUSES = [
  'draft',
  'submitted',
  'ai_rejected_same_semester',
  'ai_flagged_previous_semester',
  'revision_required',
  'pending_teacher_approval',
  'teacher_approved',
  'teacher_rejected',
];

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
    /** After previous-semester warning: student must add features before resubmit */
    requiredNewFeaturesCount: { type: Number, default: 0 },
    /** Snapshot when AI flagged previous-semester match (for diff on resubmit) */
    previousFeaturesAtFlag: [{ type: String }],
    teacherComment: { type: String, default: '' },
    submittedAt: { type: Date },
  },
  { timestamps: true }
);

proposalSchema.index({ assignment: 1, group: 1 });
proposalSchema.index({ assignment: 1, submittedBy: 1 });

export const Proposal = mongoose.model('Proposal', proposalSchema);
