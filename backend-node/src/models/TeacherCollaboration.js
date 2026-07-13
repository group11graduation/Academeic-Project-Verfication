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
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    /** Subject chosen by the teacher who sent the request. */
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    /** Subject chosen by the partner when they accept the request. */
    partnerSubject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    /** Role the requester will handle (partner gets the opposite). */
    requesterRole: {
      type: String,
      enum: ['', 'frontend', 'backend'],
      default: '',
    },
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
