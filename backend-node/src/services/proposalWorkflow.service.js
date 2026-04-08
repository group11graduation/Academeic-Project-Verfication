import mongoose from 'mongoose';
import { Assignment } from '../models/Assignment.js';
import { Group } from '../models/Group.js';
import { Proposal, PROPOSAL_STATUSES } from '../models/Proposal.js';
import { LegacyProject } from '../models/LegacyProject.js';
import { ProjectSubmission } from '../models/ProjectSubmission.js';
import { Enrollment } from '../models/Enrollment.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { analyzeProposalPayload } from './aiClient.service.js';

function buildProposalText(title, description, features) {
  const f = Array.isArray(features) ? features.filter(Boolean).join(', ') : '';
  return `${title || ''}\n${description || ''}\nFeatures: ${f}`;
}

async function assertStudentAccess(userId, assignment) {
  const subId = assignment.subject;
  const enr = await Enrollment.findOne({
    student: userId,
    class: assignment.class,
    subjects: subId,
    status: 'active',
  });
  if (!enr) {
    const err = new Error('You are not enrolled in this class for this subject');
    err.status = 403;
    throw err;
  }
}

async function assertLeaderOrSingle(userId, assignment, groupId) {
  if (assignment.submissionMode === 'single') {
    return { group: null };
  }
  if (!groupId) {
    const err = new Error('Group assignment requires a group; contact your teacher.');
    err.status = 400;
    throw err;
  }
  const gid = new mongoose.Types.ObjectId(groupId);
  const group = await Group.findOne({ _id: gid, assignment: assignment._id }).populate('members.user');
  if (!group) {
    const err = new Error('Group not found for this assignment');
    err.status = 404;
    throw err;
  }
  if (!group.leader.equals(userId)) {
    const err = new Error('Only the group leader can submit the proposal for this assignment.');
    err.status = 403;
    throw err;
  }
  return { group };
}

/**
 * Create or update draft / submit with AI + status rules.
 */
export async function upsertAndSubmitProposal(userId, assignmentId, body) {
  const { title, description, features, groupId, finalize } = body;
  if (!title?.trim()) {
    const err = new Error('Title is required');
    err.status = 400;
    throw err;
  }

  const assignment = await Assignment.findById(assignmentId)
    .populate('semester')
    .populate('academicYear')
    .populate('subject')
    .populate('class');

  if (!assignment) {
    const err = new Error('Assignment not found');
    err.status = 404;
    throw err;
  }
  if (!assignment.proposalPhaseOpen) {
    const err = new Error('Proposal phase is closed for this assignment');
    err.status = 400;
    throw err;
  }
  if (assignment.proposalDeadline && new Date() > new Date(assignment.proposalDeadline)) {
    const err = new Error('Proposal deadline has passed');
    err.status = 400;
    throw err;
  }

  await assertStudentAccess(userId, assignment);
  const { group } = await assertLeaderOrSingle(userId, assignment, groupId);

  let proposal = await Proposal.findOne(
    group
      ? { assignment: assignment._id, group: group._id }
      : { assignment: assignment._id, submittedBy: userId, group: null }
  );

  if (!proposal) {
    proposal = new Proposal({
      assignment: assignment._id,
      group: group ? group._id : null,
      submittedBy: userId,
      title: title.trim(),
      description: description?.trim() || '',
      features: Array.isArray(features) ? features.map((x) => String(x).trim()).filter(Boolean) : [],
      status: 'draft',
    });
  } else {
    proposal.title = title.trim();
    proposal.description = description?.trim() || '';
    proposal.features = Array.isArray(features) ? features.map((x) => String(x).trim()).filter(Boolean) : [];
  }

  if (!finalize) {
    proposal.status = 'draft';
    await proposal.save();
    return { proposal, ai: null, message: 'Draft saved' };
  }

  if (proposal.status === 'ai_flagged_previous_semester' && proposal.previousFeaturesAtFlag?.length) {
    const prev = new Set(proposal.previousFeaturesAtFlag.map((f) => f.toLowerCase()));
    const newOnes = proposal.features.filter((f) => !prev.has(String(f).toLowerCase()));
    if (newOnes.length < Math.max(2, proposal.requiredNewFeaturesCount || 2)) {
      const err = new Error(
        'Add at least two new features (not listed before) before resubmitting after a previous-semester similarity warning.'
      );
      err.status = 400;
      throw err;
    }
  }

  await proposal.save();

  // Finalize: run AI pipeline
  const text = buildProposalText(proposal.title, proposal.description, proposal.features);

  const sameContextAssignmentIds = await Assignment.find({
    semester: assignment.semester._id,
    subject: assignment.subject._id,
    class: assignment.class._id,
  }).distinct('_id');

  const sameSemesterOthers = await Proposal.find({
    assignment: { $in: sameContextAssignmentIds },
    _id: { $ne: proposal._id },
    status: {
      $in: [
        'submitted',
        'ai_flagged_previous_semester',
        'revision_required',
        'pending_teacher_approval',
        'teacher_approved',
      ],
    },
  }).exec();

  const sameSemesterPayload = sameSemesterOthers.map((p) => ({
    id: p._id.toString(),
    text: buildProposalText(p.title, p.description, p.features),
  }));

  const legacyDocs = await LegacyProject.find({
    subject: assignment.subject._id,
    class: assignment.class._id,
    $or: [
      { semester: { $ne: assignment.semester._id } },
      { academicYear: { $ne: assignment.academicYear._id } },
    ],
  })
    .limit(80)
    .lean();

  const legacyPayload = legacyDocs.map((l) => ({
    id: l._id.toString(),
    text: buildProposalText(l.title, l.proposalDescription || '', l.features || []),
    title: l.title,
    semesterLabel: l.semester?.toString?.() || '',
  }));

  let aiResult;
  try {
    aiResult = await analyzeProposalPayload({
      text,
      same_semester: sameSemesterPayload,
      legacy: legacyPayload,
    });
  } catch (e) {
    const err = new Error(e.message || 'AI analysis failed');
    err.status = 503;
    throw err;
  }

  proposal.aiSameSemesterMaxScore = aiResult.same_semester_max ?? 0;
  proposal.aiPreviousSemesterMaxScore = aiResult.legacy_max ?? 0;
  proposal.aiMatchedProposalId = aiResult.matched_proposal_id
    ? new mongoose.Types.ObjectId(aiResult.matched_proposal_id)
    : null;
  proposal.aiMatchedLegacyId = aiResult.matched_legacy_id
    ? new mongoose.Types.ObjectId(aiResult.matched_legacy_id)
    : null;
  proposal.aiSummary = aiResult.summary || '';
  proposal.submittedAt = new Date();

  const verdict = aiResult.verdict;

  if (verdict === 'reject_same_semester') {
    proposal.status = 'ai_rejected_same_semester';
    proposal.requiredNewFeaturesCount = 0;
  } else if (verdict === 'warn_previous_semester') {
    proposal.status = 'ai_flagged_previous_semester';
    proposal.requiredNewFeaturesCount = Math.max(2, proposal.requiredNewFeaturesCount || 0);
    proposal.previousFeaturesAtFlag = [...proposal.features];
  } else {
    proposal.status = 'pending_teacher_approval';
    proposal.requiredNewFeaturesCount = 0;
    proposal.previousFeaturesAtFlag = [];
  }

  await proposal.save();

  return {
    proposal,
    ai: aiResult,
    message:
      verdict === 'reject_same_semester'
        ? 'This proposal is too similar to another project in your current semester. Please change the idea, description, and features.'
        : verdict === 'warn_previous_semester'
          ? 'This idea resembles an approved project from a previous semester. Add meaningful new features before requesting teacher approval.'
          : 'Proposal sent to your teacher for approval.',
  };
}

export async function resubmitAfterRevision(userId, assignmentId, body) {
  return upsertAndSubmitProposal(userId, assignmentId, { ...body, finalize: true });
}

/** Teacher actions */
export async function teacherReviewProposal(teacherId, proposalId, { action, comment }) {
  const proposal = await Proposal.findById(proposalId).populate('assignment');
  if (!proposal) {
    const err = new Error('Proposal not found');
    err.status = 404;
    throw err;
  }
  if (!proposal.assignment.teacher.equals(teacherId)) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }

  const reviewable = ['pending_teacher_approval'];
  if (!reviewable.includes(proposal.status)) {
    const err = new Error('Proposal is not awaiting teacher review in its current state');
    err.status = 400;
    throw err;
  }

  proposal.teacherComment = comment || '';

  if (action === 'approve') {
    proposal.status = 'teacher_approved';
  } else if (action === 'reject') {
    proposal.status = 'teacher_rejected';
  } else if (action === 'revision') {
    proposal.status = 'revision_required';
  } else {
    const err = new Error('Invalid action');
    err.status = 400;
    throw err;
  }

  await proposal.save();
  return proposal;
}

export async function listProposalsForTeacher(teacherId, assignmentId) {
  let filter;
  if (assignmentId) {
    const a = await Assignment.findOne({ _id: assignmentId, teacher: teacherId });
    if (!a) return [];
    filter = { assignment: assignmentId };
  } else {
    const assignmentIds = await Assignment.find({ teacher: teacherId }).distinct('_id');
    filter = { assignment: { $in: assignmentIds } };
  }
  const list = await Proposal.find(filter)
    .populate('submittedBy', 'name email')
    .populate('group')
    .populate({
      path: 'assignment',
      select: 'title class subject semester',
      populate: [{ path: 'class', select: 'code name' }, { path: 'subject', select: 'code name' }],
    })
    .sort({ updatedAt: -1 })
    .lean();

  const ids = list.map((p) => p._id);
  const withSub = ids.length
    ? await ProjectSubmission.distinct('proposal', { proposal: { $in: ids } })
    : [];
  const subSet = new Set(withSub.map(String));
  return list.map((p) => ({ ...p, hasProjectSubmission: subSet.has(String(p._id)) }));
}

export async function getProposalForStudent(userId, proposalId) {
  const p = await Proposal.findById(proposalId)
    .populate('assignment')
    .populate('group')
    .populate('aiMatchedLegacyId');
  if (!p) {
    const err = new Error('Proposal not found');
    err.status = 404;
    throw err;
  }
  if (!p.submittedBy.equals(userId) && p.assignment?.submissionMode === 'single') {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  if (p.group) {
    const g = await Group.findById(p.group);
    const isMember = g?.members.some((m) => m.user.equals(userId)) || g?.leader.equals(userId);
    if (!isMember) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
  }
  return p;
}

/** Whether student may start project submission */
export async function canAccessProjectSubmission(userId, assignmentId) {
  const assignment = await Assignment.findById(assignmentId);
  if (!assignment?.projectPhaseOpen) {
    return { allowed: false, reason: 'Project phase is not open yet.' };
  }

  let prop;
  if (assignment.submissionMode === 'single') {
    prop = await Proposal.findOne({
      assignment: assignmentId,
      submittedBy: userId,
      group: null,
    }).sort({ updatedAt: -1 });
  } else {
    const group = await Group.findOne({
      assignment: assignmentId,
      leader: userId,
    });
    if (!group) {
      return {
        allowed: false,
        reason: 'Only the group leader may submit the project. Your proposal must be teacher-approved first.',
      };
    }
    prop = await Proposal.findOne({ assignment: assignmentId, group: group._id }).sort({ updatedAt: -1 });
  }

  if (!prop || prop.status !== 'teacher_approved') {
    return {
      allowed: false,
      reason: 'Your proposal must be teacher-approved before you can submit the project.',
    };
  }
  return { allowed: true, proposal: prop };
}
