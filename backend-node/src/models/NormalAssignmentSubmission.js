import mongoose from 'mongoose';

const normalAssignmentSubmissionSchema = new mongoose.Schema(
  {
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    /** Relative path inside uploads, e.g. normal-assignment/<assignmentId>/<userId>/<file> */
    storedRelativePath: { type: String, required: true },
    originalFilename: { type: String, default: '' },
    mimeType: { type: String, default: 'application/octet-stream' },
    sizeBytes: { type: Number, default: 0 },
    contentHash: { type: String, default: '' },
    extractedText: { type: String, default: '' },
    plagiarismScore: { type: Number, default: 0, min: 0, max: 1 },
    plagiarismFlag: { type: Boolean, default: false },
    plagiarismMethod: { type: String, default: 'none' },
    matchedSubmissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'NormalAssignmentSubmission', default: null },
  },
  { timestamps: true }
);

normalAssignmentSubmissionSchema.index({ assignment: 1, submittedBy: 1, createdAt: -1 });
normalAssignmentSubmissionSchema.index({ assignment: 1, contentHash: 1 });

export const NormalAssignmentSubmission = mongoose.model('NormalAssignmentSubmission', normalAssignmentSubmissionSchema);
