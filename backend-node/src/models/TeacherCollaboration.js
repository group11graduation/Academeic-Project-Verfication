import mongoose from 'mongoose';

export const COLLABORATION_STATUSES = ['pending', 'accepted', 'declined', 'revoked'];

const teacherCollaborationSchema = new mongoose.Schema(
  {
    /** Teacher who initiated the collaboration request */
    primaryTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    /** Partner teacher in the collaboration pair */
    coTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: COLLABORATION_STATUSES,
      default: 'pending',
    },
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    acceptedAt: { type: Date },
    notes: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'TeacherCollaborations',
  }
);

teacherCollaborationSchema.index({ primaryTeacher: 1, coTeacher: 1 }, { unique: true });
teacherCollaborationSchema.index({ coTeacher: 1, status: 1 });
teacherCollaborationSchema.index({ primaryTeacher: 1, status: 1 });

export const TeacherCollaboration = mongoose.model('TeacherCollaboration', teacherCollaborationSchema);
