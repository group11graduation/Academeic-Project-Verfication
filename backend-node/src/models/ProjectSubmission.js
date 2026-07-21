import mongoose from 'mongoose';

const collaborativeProjectReviewSchema = new mongoose.Schema(
  {
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    comment: { type: String, default: '' },
    score: { type: Number, min: 0, default: null },
    scoreMax: { type: Number, min: 1, default: 100 },
    reviewedAt: { type: Date },
  },
  { _id: false }
);

/** Student-uploaded project archive (ZIP) linked to an approved-proposal context */
const projectSubmissionSchema = new mongoose.Schema(
  {
    proposal: { type: mongoose.Schema.Types.ObjectId, ref: 'Proposal', required: true },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
    /** Relative to process.cwd() uploads root, e.g. project-code/<proposalId>/file.zip */
    storedRelativePath: { type: String, required: true },
    originalFilename: { type: String, default: '' },
    sizeBytes: { type: Number, default: 0 },
    mimeType: { type: String, default: 'application/zip' },
    /** Increments when the student replaces the ZIP before the deadline */
    version: { type: Number, default: 1 },
    /** Optional hint for preview auto-detect */
    projectStackHint: {
      type: String,
      enum: ['', 'static-html', 'static-html-js', 'node-js', 'java-spring-react', 'php-apache'],
      default: '',
    },
    /** ZIP extract + tech-audit pipeline state for teacher preview / upload validation */
    pipelineStatus: {
      type: String,
      enum: ['', 'accepted', 'failed_extraction', 'tech_audit_rejected', 'tech_mismatch_rejected'],
      default: '',
    },
    pipelineUpdatedAt: { type: Date },
    pipelineError: { type: String, default: '' },
    pipelineFailures: [
      {
        rule: { type: String, default: '' },
        message: { type: String, default: '' },
        path: { type: String, default: '' },
      },
    ],
    lastExtractAt: { type: Date },
    lastExtractFileCount: { type: Number },
    lastAuditAt: { type: Date },
    lastRuntimeErrorAt: { type: Date },
    /** UI preview image for verified projects gallery (png/jpg/webp) */
    screenshotRelativePath: { type: String, default: '' },
    /** Teacher review of the uploaded project (separate from proposal feedback) */
    teacherComment: { type: String, default: '' },
    teacherScore: { type: Number, min: 0, default: null },
    teacherScoreMax: { type: Number, min: 1, default: 100 },
    teacherReviewedAt: { type: Date },
    /** Set when teacher successfully opens a live preview of this ZIP */
    teacherPreviewedAt: { type: Date },
    /** Dual-teacher project feedback (frontend + backend teachers) */
    collaborativeProjectReviews: {
      frontend: { type: collaborativeProjectReviewSchema, default: () => ({}) },
      backend: { type: collaborativeProjectReviewSchema, default: () => ({}) },
    },
  },
  { timestamps: true }
);


projectSubmissionSchema.index({ proposal: 1, createdAt: -1 });

export const ProjectSubmission = mongoose.model('ProjectSubmission', projectSubmissionSchema);
