import mongoose from 'mongoose';

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
  },
  { timestamps: true }
);

projectSubmissionSchema.index({ proposal: 1, createdAt: -1 });

export const ProjectSubmission = mongoose.model('ProjectSubmission', projectSubmissionSchema);
