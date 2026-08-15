import mongoose from 'mongoose';

const collaborativeProjectReviewSchema = new mongoose.Schema(
  {
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    comment: { type: String, default: '' },
    score: { type: Number, min: 0, default: null },
    scoreMax: { type: Number, min: 1, default: 100 },
    reviewedAt: { type: Date },
    decision: {
      type: String,
      enum: ['', 'approved', 'rejected', 'revision_required'],
      default: '',
    },
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
    /**
     * Relative to uploads root, e.g. project-code/<proposalId>/project.zip.
     * Empty when the latest attempt was rejected before permanent save.
     */
    storedRelativePath: { type: String, default: '' },
    originalFilename: { type: String, default: '' },
    sizeBytes: { type: Number, default: 0 },
    mimeType: { type: String, default: 'application/zip' },
    /** sha256 of accepted ZIP bytes - used to block exact copies from other students */
    contentHash: { type: String, default: '', index: true },
    /** Increments when the student replaces the ZIP before the deadline */
    version: { type: Number, default: 1 },
    /** Optional hint for preview auto-detect */
    projectStackHint: {
      type: String,
      enum: [
        '',
        'static-html',
        'static-html-js',
        'node-js',
        'node-js-mysql',
        'java-spring-react',
        'java-spring-thymeleaf',
        'php-apache',
        'laravel-react-mysql',
      ],
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
    /**
     * Pre-upload ML consistency check (POST /analyze/consistency).
     * Stored on every attempt so teacher UI can show scores without recomputing.
     */
    consistencyCheck: {
      tech_match_score: { type: Number, default: null },
      description_match_score: { type: Number, default: null },
      tech_verdict: { type: String, default: '' },
      description_verdict: { type: String, default: '' },
      overall_verdict: { type: String, default: '' },
      needs_review: { type: Boolean, default: false },
      checkedAt: { type: Date },
    },
    lastExtractAt: { type: Date },
    lastExtractFileCount: { type: Number },
    lastAuditAt: { type: Date },
    lastRuntimeErrorAt: { type: Date },
    /** UI preview image for verified projects gallery (png/jpg/webp) - first/primary */
    screenshotRelativePath: { type: String, default: '' },
    /** Multiple UI screenshots for gallery (4–10). Primary also mirrored in screenshotRelativePath. */
    screenshotRelativePaths: [{ type: String }],
    /** Teacher review of the uploaded project (separate from proposal feedback) */
    teacherComment: { type: String, default: '' },
    teacherScore: { type: Number, min: 0, default: null },
    teacherScoreMax: { type: Number, min: 1, default: 100 },
    teacherReviewedAt: { type: Date },
    /**
     * Teacher decision on the uploaded project ZIP (after preview / screenshots).
     * Cleared when the student uploads a replacement ZIP.
     */
    teacherDecision: {
      type: String,
      enum: ['', 'approved', 'rejected', 'revision_required'],
      default: '',
    },
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
