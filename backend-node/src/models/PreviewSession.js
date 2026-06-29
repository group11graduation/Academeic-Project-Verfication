import mongoose from 'mongoose';

const PREVIEW_STATUSES = ['starting', 'running', 'stopped', 'failed', 'expired', 'runtime_error'];

const logEntrySchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    level: { type: String, enum: ['info', 'warn', 'error'], default: 'info' },
    message: { type: String, required: true },
  },
  { _id: false }
);

const previewSessionSchema = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    proposal: { type: mongoose.Schema.Types.ObjectId, ref: 'Proposal', required: true },
    submission: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectSubmission', required: true },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    status: { type: String, enum: PREVIEW_STATUSES, default: 'starting' },
    dockerContainerId: { type: String, default: '' },
    hostPort: { type: String, default: '' },
    /** Host port mapped to student API (MERN backend), when separate from UI port */
    previewApiHostPort: { type: String, default: '' },
    previewUrl: { type: String, default: '' },
    previewApiUrl: { type: String, default: '' },
    previewImage: { type: String, default: '' },
    /** Detected runtime stack: node-js | php-apache | jupyter | static-html | static-html-js */
    previewStack: { type: String, default: '' },
    /** Human label e.g. "Vue + Express", "React + Express API" */
    previewStackLabel: { type: String, default: '' },
    /** Demo admin login for teacher review inside student app */
    previewLoginEmail: { type: String, default: '' },
    previewLoginPassword: { type: String, default: '' },
    previewLoginUrl: { type: String, default: '' },
    previewLoginSource: {
      type: String,
      enum: ['', 'platform_default', 'teacher_provided', 'project_files'],
      default: '',
    },
    previewLoginHint: { type: String, default: '' },
    memoryBytes: { type: Number },
    nanoCpus: { type: Number },
    ttlMs: { type: Number },
    /** When the app became reachable (TTL countdown starts here) */
    readyAt: { type: Date },
    /** Scheduled auto-stop time */
    expiresAt: { type: Date },
    /** Server-local extract path for cleanup (not exposed to clients) */
    extractDirPath: { type: String, default: '' },
    logs: [logEntrySchema],
    errorMessage: { type: String, default: '' },
    /** Full docker stderr/stdout tail when status is runtime_error */
    runtimeTraceback: { type: String, default: '' },
    validationFailures: [
      {
        rule: { type: String, default: '' },
        message: { type: String, default: '' },
        path: { type: String, default: '' },
      },
    ],
    startedAt: { type: Date },
    endedAt: { type: Date },
  },
  { timestamps: true }
);

previewSessionSchema.index({ proposal: 1, status: 1 });
previewSessionSchema.index({ teacher: 1, createdAt: -1 });

export const PreviewSession = mongoose.model('PreviewSession', previewSessionSchema);
export { PREVIEW_STATUSES };
