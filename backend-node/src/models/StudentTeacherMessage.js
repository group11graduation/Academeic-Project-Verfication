import mongoose from 'mongoose';

export const MESSAGE_CATEGORIES = [
  'deadline_extension',
  'general',
  'submission_help',
  'feedback_question',
];

export const MESSAGE_STATUSES = ['open', 'replied', 'closed'];

export const DEADLINE_TYPES = ['proposal', 'project', 'normal_submission', ''];

export const RECIPIENT_TARGETS = ['primary', 'frontend', 'backend', 'both'];

const studentTeacherMessageSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    /** Primary / legacy recipient (first targeted teacher) */
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    /** All teachers who should see and can reply to this message */
    recipientTeacherIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    /** frontend | backend | both | primary */
    recipientTarget: {
      type: String,
      enum: RECIPIENT_TARGETS,
      default: 'primary',
    },
    /** Human label e.g. "Both teachers" or "Frontend teacher — ALI" */
    recipientLabel: { type: String, default: '' },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    category: {
      type: String,
      enum: MESSAGE_CATEGORIES,
      default: 'general',
    },
    /** When category is deadline_extension: which deadline the student is asking about */
    deadlineType: {
      type: String,
      enum: DEADLINE_TYPES,
      default: '',
    },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    status: {
      type: String,
      enum: MESSAGE_STATUSES,
      default: 'open',
    },
    teacherReply: { type: String, default: '', maxlength: 4000 },
    teacherRepliedAt: { type: Date },
    teacherRepliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

studentTeacherMessageSchema.index({ student: 1, createdAt: -1 });
studentTeacherMessageSchema.index({ assignment: 1, createdAt: -1 });
studentTeacherMessageSchema.index({ teacher: 1, status: 1, createdAt: -1 });
studentTeacherMessageSchema.index({ recipientTeacherIds: 1, status: 1, createdAt: -1 });

export const StudentTeacherMessage = mongoose.model('StudentTeacherMessage', studentTeacherMessageSchema);
