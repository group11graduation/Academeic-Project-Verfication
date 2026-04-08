import { Enrollment } from '../models/Enrollment.js';
import { Assignment } from '../models/Assignment.js';
import { Proposal } from '../models/Proposal.js';
import { Group } from '../models/Group.js';
import { ProjectSubmission } from '../models/ProjectSubmission.js';

export async function listAssignmentsWithProposalsForStudent(userId) {
  const enrollments = await Enrollment.find({ student: userId, status: 'active' })
    .populate('class', 'code name')
    .lean();

  const orFilters = [];
  for (const e of enrollments) {
    const subs = e.subjects || [];
    for (const sid of subs) {
      orFilters.push({ class: e.class._id, subject: sid, isActive: true });
    }
  }
  if (!orFilters.length) return [];

  const assignments = await Assignment.find({ $or: orFilters })
    .populate('teacher', 'name email')
    .populate('subject', 'code name')
    .populate('semester', 'name')
    .populate('academicYear', 'label')
    .populate('class', 'code name')
    .sort({ createdAt: -1 })
    .lean();

  const out = [];
  for (const a of assignments) {
    let proposal = await Proposal.findOne({
      assignment: a._id,
      submittedBy: userId,
      group: null,
    })
      .sort({ updatedAt: -1 })
      .lean();

    if (!proposal && a.submissionMode === 'group') {
      const groups = await Group.find({
        assignment: a._id,
        $or: [{ leader: userId }, { 'members.user': userId }],
      }).select('_id');
      const gids = groups.map((g) => g._id);
      if (gids.length) {
        proposal = await Proposal.findOne({ assignment: a._id, group: { $in: gids } })
          .sort({ updatedAt: -1 })
          .lean();
      }
    }

    const groupInfo =
      a.submissionMode === 'group'
        ? await Group.findOne({
            assignment: a._id,
            $or: [{ leader: userId }, { 'members.user': userId }],
          })
            .populate('leader', 'name email')
            .populate('members.user', 'name email')
            .lean()
        : null;

    const isLeader = groupInfo ? String(groupInfo.leader?._id || groupInfo.leader) === String(userId) : true;
    const approved = proposal?.status === 'teacher_approved';
    const projectSubmissionAllowed =
      !!a.projectPhaseOpen && approved && (a.submissionMode !== 'group' || isLeader);

    let latestProjectSubmission = null;
    if (proposal?._id) {
      latestProjectSubmission = await ProjectSubmission.findOne({ proposal: proposal._id })
        .sort({ createdAt: -1 })
        .select('originalFilename sizeBytes createdAt')
        .lean();
    }

    out.push({
      assignment: a,
      proposal: proposal || null,
      group: groupInfo,
      isGroupLeader: isLeader,
      projectSubmissionAllowed,
      latestProjectSubmission,
    });
  }

  return out;
}

export async function getAssignmentDetailForStudent(userId, assignmentId) {
  const rows = await listAssignmentsWithProposalsForStudent(userId);
  const row = rows.find((r) => String(r.assignment._id) === String(assignmentId));
  if (!row) {
    const err = new Error('Assignment not found or not available for your enrollment');
    err.status = 404;
    throw err;
  }
  return row;
}
