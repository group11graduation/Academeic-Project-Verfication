import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import mammoth from 'mammoth';
import { Assignment } from '../models/Assignment.js';
import { Group } from '../models/Group.js';
import { Proposal, PROPOSAL_STATUSES } from '../models/Proposal.js';
import { LegacyProject } from '../models/LegacyProject.js';
import { ProjectSubmission } from '../models/ProjectSubmission.js';
import { Enrollment } from '../models/Enrollment.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { Class } from '../models/Class.js';
import { analyzeProposalPayload } from './aiClient.service.js';
import { evaluateProposalAgainstAssignmentRequirements } from './requirementCheck.service.js';

const AI_SAME_SEMESTER_MAX_CANDIDATES = Number(process.env.AI_SAME_SEMESTER_MAX_CANDIDATES || 40);
const AI_LEGACY_MAX_CANDIDATES = Number(process.env.AI_LEGACY_MAX_CANDIDATES || 40);
const AI_MAX_TEXT_CHARS = Number(process.env.AI_MAX_TEXT_CHARS || 3500);
const AI_CROSS_SEMESTER_SCOPE = String(process.env.AI_CROSS_SEMESTER_SCOPE || 'subject').toLowerCase();

function buildProposalText(title, description, features) {
  const f = Array.isArray(features) ? features.filter(Boolean).join(', ') : '';
  return `${title || ''}\n${description || ''}\nFeatures: ${f}`;
}

function clipAiText(text) {
  return String(text || '').slice(0, AI_MAX_TEXT_CHARS);
}

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeFeatures(features) {
  return (Array.isArray(features) ? features : [])
    .map((f) => normalizeText(f))
    .filter(Boolean)
    .sort();
}

function hasProposalContentChanged(previousProposal, { title, description, features }) {
  const prevTitle = normalizeText(previousProposal?.title);
  const prevDescription = normalizeText(previousProposal?.description);
  const prevFeatures = normalizeFeatures(previousProposal?.features);

  const nextTitle = normalizeText(title);
  const nextDescription = normalizeText(description);
  const nextFeatures = normalizeFeatures(features);

  return (
    prevTitle !== nextTitle ||
    prevDescription !== nextDescription ||
    JSON.stringify(prevFeatures) !== JSON.stringify(nextFeatures)
  );
}

function parseStructuredProposalText(rawText) {
  const text = String(rawText || '').replace(/\r/g, '');
  const lines = text.split('\n');
  let title = '';
  let description = '';
  const features = [];
  let section = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('title:')) {
      section = 'title';
      title = trimmed.slice(6).trim();
      continue;
    }
    if (lower.startsWith('description:')) {
      section = 'description';
      const v = trimmed.slice(12).trim();
      if (v) description += `${description ? ' ' : ''}${v}`;
      continue;
    }
    if (lower.startsWith('features:')) {
      section = 'features';
      const v = trimmed.slice(9).trim();
      if (v) features.push(v);
      continue;
    }
    if (section === 'features') {
      const cleaned = trimmed.replace(/^[-*]\s*/, '').trim();
      if (cleaned) features.push(cleaned);
    } else if (section === 'description') {
      description += `${description ? ' ' : ''}${trimmed}`;
    } else if (!title) {
      title = trimmed;
    } else {
      description += `${description ? ' ' : ''}${trimmed}`;
    }
  }
  return {
    title: title.trim(),
    description: description.trim(),
    features: features.map((f) => f.trim()).filter(Boolean),
  };
}

async function readProposalFileText(file) {
  if (!file?.path) return '';
  const ext = path.extname(file.originalname || file.filename || '').toLowerCase();
  const allowed = new Set(['.txt', '.md', '.json', '.csv', '.docx']);
  if (!allowed.has(ext)) {
    const err = new Error('Unsupported proposal file type. Use .txt, .md, .json, .csv, or .docx');
    err.status = 400;
    throw err;
  }
  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: file.path });
    return String(result.value || '').trim();
  }
  const data = await fs.readFile(file.path, 'utf8');
  return data || '';
}

async function assertStudentAccess(userId, assignment) {
  const subId = String(assignment.subject?._id || assignment.subject);
  const classIds = Array.isArray(assignment.classes) && assignment.classes.length
    ? assignment.classes.map((c) => String(c?._id || c)).filter(Boolean)
    : [String(assignment.class?._id || assignment.class)].filter(Boolean);

  for (const classId of classIds) {
    // Primary: active enrollment with subject directly assigned.
    let enr = await Enrollment.findOne({
      student: userId,
      class: classId,
      subjects: assignment.subject,
      status: 'active',
    }).lean();
    if (enr) return;

    // Secondary: enrollment exists for class but subjects array is missing/empty; fallback to class subjects.
    const classEnrollment = await Enrollment.findOne({
      student: userId,
      class: classId,
      status: 'active',
    }).lean();
    if (classEnrollment) {
      const hasSubjectOnEnrollment = Array.isArray(classEnrollment.subjects) && classEnrollment.subjects
        .map((s) => String(s))
        .includes(subId);
      if (hasSubjectOnEnrollment) return;

      const cls = await Class.findById(classId).select('subjects').lean();
      const classSubjects = (cls?.subjects || []).map((s) => String(s));
      if (classSubjects.includes(subId)) return;
    }

    // Final fallback: student linked by StudentProfile.classCode to this class code.
    const profile = await StudentProfile.findOne({ user: userId }).select('classCode').lean();
    if (profile?.classCode) {
      const cls = await Class.findById(classId).select('code subjects').lean();
      const profileCode = String(profile.classCode || '').trim().toUpperCase();
      const classCode = String(cls?.code || '').trim().toUpperCase();
      if (profileCode && classCode && profileCode === classCode) {
        const classSubjects = (cls?.subjects || []).map((s) => String(s));
        if (classSubjects.includes(subId)) return;
      }
    }
  }

  const err = new Error('You are not enrolled in this class for this subject');
  err.status = 403;
  throw err;
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
export async function upsertAndSubmitProposal(userId, assignmentId, body, proposalFile = null) {
  let { title, description, features, groupId, finalize } = body;
  if ((!title || !String(title).trim()) && proposalFile) {
    const extractedText = await readProposalFileText(proposalFile);
    const parsed = parseStructuredProposalText(extractedText);
    title = parsed.title;
    description = parsed.description;
    features = parsed.features;
  }
  if (!title?.trim()) {
    const err = new Error('Title is required (or upload a structured proposal file).');
    err.status = 400;
    throw err;
  }

  const assignment = await Assignment.findById(assignmentId)
    .populate('semester')
    .populate('academicYear')
    .populate('subject')
    .populate('class')
    .populate('classes');

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
    const previousSnapshot = {
      title: proposal.title,
      description: proposal.description,
      features: Array.isArray(proposal.features) ? [...proposal.features] : [],
      status: proposal.status,
    };

    if (finalize && proposal.status === 'teacher_approved') {
      const err = new Error('Proposal already approved. You cannot submit another one for this assignment.');
      err.status = 400;
      throw err;
    }
    proposal.title = title.trim();
    proposal.description = description?.trim() || '';
    proposal.features = Array.isArray(features) ? features.map((x) => String(x).trim()).filter(Boolean) : [];
    const unchangedComparedToPrevious = !hasProposalContentChanged(previousSnapshot, {
      title: proposal.title,
      description: proposal.description,
      features: proposal.features,
    });

    if (finalize && previousSnapshot.status !== 'draft' && unchangedComparedToPrevious) {
      return {
        proposal,
        ai: null,
        message: 'This same proposal was already submitted before.',
        recommendation:
          'Update the title, description, or features to clearly show what changed before resubmitting.',
      };
    }

    if (
      finalize &&
      ['teacher_rejected', 'revision_required'].includes(previousSnapshot.status) &&
      unchangedComparedToPrevious
    ) {
      const err = new Error(
        'Your last proposal was rejected/revision-required. Update title, description, or features before resubmitting.'
      );
      err.status = 400;
      throw err;
    }
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

  const assignmentClassIds = Array.isArray(assignment.classes) && assignment.classes.length
    ? assignment.classes.map((c) => c._id)
    : [assignment.class?._id || assignment.class].filter(Boolean);

  // Requirement pre-check gate (runs BEFORE semantic AI checks)
  const requirementCheck = evaluateProposalAgainstAssignmentRequirements(assignment, proposal);
  proposal.requirementCheckPassed = requirementCheck.passed;
  proposal.requirementCheckSummary = requirementCheck.summary;
  proposal.requirementMissingKeywords = requirementCheck.missingKeywords;
  proposal.requirementAllowedTechMatched = requirementCheck.matchedAllowedTech;
  if (!requirementCheck.passed) {
    proposal.status = 'requirements_rejected';
    proposal.submittedAt = new Date();
    await proposal.save();
    return {
      proposal,
      ai: null,
      message: `Rejected automatically: ${requirementCheck.summary}`,
    };
  }

  // Finalize: run AI pipeline
  const text = buildProposalText(proposal.title, proposal.description, proposal.features);

  const sameContextAssignmentIds = await Assignment.find({
    semester: assignment.semester._id,
    subject: assignment.subject._id,
    $or: [
      { class: { $in: assignmentClassIds } },
      { classes: { $in: assignmentClassIds } },
    ],
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
  })
    .sort({ updatedAt: -1 })
    .limit(Math.max(0, AI_SAME_SEMESTER_MAX_CANDIDATES))
    .select('_id title description features')
    .lean();

  const sameSemesterPayload = sameSemesterOthers.map((p) => ({
    id: p._id.toString(),
    text: clipAiText(buildProposalText(p.title, p.description, p.features)),
  }));

  const crossSemesterAssignmentFilter = {
    subject: assignment.subject._id,
    $or: [
      { semester: { $ne: assignment.semester._id } },
      { academicYear: { $ne: assignment.academicYear._id } },
    ],
  };
  if (AI_CROSS_SEMESTER_SCOPE === 'subject_class') {
    crossSemesterAssignmentFilter.$and = [
      {
        $or: [
          { class: { $in: assignmentClassIds } },
          { classes: { $in: assignmentClassIds } },
        ],
      },
    ];
  }

  const crossSemesterAssignmentIds = await Assignment.find(crossSemesterAssignmentFilter).distinct('_id');
  const crossSemesterProposals = crossSemesterAssignmentIds.length
    ? await Proposal.find({
        assignment: { $in: crossSemesterAssignmentIds },
        status: { $in: ['teacher_approved', 'pending_teacher_approval', 'revision_required'] },
      })
        .sort({ updatedAt: -1 })
        .limit(Math.max(0, AI_LEGACY_MAX_CANDIDATES))
        .select('_id title description features assignment')
        .populate({ path: 'assignment', select: 'semester', populate: { path: 'semester', select: 'name' } })
        .lean()
    : [];

  const legacyDocs = await LegacyProject.find({
    subject: assignment.subject._id,
    $or: [
      { semester: { $ne: assignment.semester._id } },
      { academicYear: { $ne: assignment.academicYear._id } },
    ],
    ...(AI_CROSS_SEMESTER_SCOPE === 'subject_class' ? { class: { $in: assignmentClassIds } } : {}),
  })
    .sort({ createdAt: -1 })
    .limit(Math.max(0, AI_LEGACY_MAX_CANDIDATES))
    .select('_id title proposalDescription features semester academicYear')
    .lean();

  const legacyFromArchive = legacyDocs.map((l) => ({
    id: `legacy:${l._id.toString()}`,
    text: clipAiText(buildProposalText(l.title, l.proposalDescription || '', l.features || [])),
    title: l.title,
    semesterLabel: l.semester?.toString?.() || '',
  }));
  const legacyFromCrossSemester = crossSemesterProposals.map((p) => ({
    id: `proposal:${p._id.toString()}`,
    text: clipAiText(buildProposalText(p.title, p.description || '', p.features || [])),
    title: p.title || '',
    semesterLabel: p.assignment?.semester?.name || '',
  }));
  const legacyPayload = [...legacyFromArchive, ...legacyFromCrossSemester].slice(0, Math.max(0, AI_LEGACY_MAX_CANDIDATES));

  let aiResult;
  try {
    aiResult = await analyzeProposalPayload({
      text: clipAiText(text),
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
  const matchedSameSemesterId = String(aiResult.matched_proposal_id || '').trim();
  const matchedLegacyRaw = String(aiResult.matched_legacy_id || '').trim();
  const matchedLegacyId = matchedLegacyRaw.startsWith('legacy:') ? matchedLegacyRaw.slice(7) : matchedLegacyRaw;
  const matchedLegacyProposalId = matchedLegacyRaw.startsWith('proposal:') ? matchedLegacyRaw.slice(9) : '';

  proposal.aiMatchedProposalId = mongoose.Types.ObjectId.isValid(matchedSameSemesterId)
    ? new mongoose.Types.ObjectId(matchedSameSemesterId)
    : mongoose.Types.ObjectId.isValid(matchedLegacyProposalId)
      ? new mongoose.Types.ObjectId(matchedLegacyProposalId)
      : null;
  proposal.aiMatchedLegacyId = mongoose.Types.ObjectId.isValid(matchedLegacyId)
    ? new mongoose.Types.ObjectId(matchedLegacyId)
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

function applyTeacherEvalFields(proposal, body) {
  const { comment, teacherProposalScore, vsAi } = body || {};
  if (comment !== undefined) proposal.teacherComment = comment == null ? '' : String(comment);
  if (Object.prototype.hasOwnProperty.call(body || {}, 'teacherProposalScore')) {
    const raw = body.teacherProposalScore;
    if (raw === null || raw === '' || raw === undefined) {
      proposal.teacherProposalScore = null;
    } else {
      const n = Number(raw);
      if (!Number.isNaN(n) && n >= 0 && n <= 100) proposal.teacherProposalScore = n;
    }
  }
  if (vsAi !== undefined && ['not_set', 'aligns', 'stricter', 'lenient'].includes(String(vsAi))) {
    proposal.teacherVsAi = vsAi;
  }
}

/** Teacher actions */
export async function teacherReviewProposal(teacherId, proposalId, body) {
  const { action, comment, teacherProposalScore, vsAi } = body || {};
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

  if (action === 'comment') {
    applyTeacherEvalFields(proposal, { comment, teacherProposalScore, vsAi });
    await proposal.save();
    return proposal;
  }

  const reviewable = ['pending_teacher_approval'];
  if (!reviewable.includes(proposal.status)) {
    const err = new Error('Proposal is not awaiting teacher review in its current state');
    err.status = 400;
    throw err;
  }

  applyTeacherEvalFields(proposal, { comment, teacherProposalScore, vsAi });

  if (action === 'approve') {
    const assignment = await Assignment.findById(proposal.assignment._id);
    const requirementCheck = evaluateProposalAgainstAssignmentRequirements(assignment, proposal);
    proposal.requirementCheckPassed = requirementCheck.passed;
    proposal.requirementCheckSummary = requirementCheck.summary;
    proposal.requirementMissingKeywords = requirementCheck.missingKeywords;
    proposal.requirementAllowedTechMatched = requirementCheck.matchedAllowedTech;

    if (!requirementCheck.passed) {
      proposal.status = 'teacher_rejected';
      const prev = proposal.teacherComment || '';
      proposal.teacherComment = [prev, requirementCheck.summary].filter(Boolean).join(' | ');
      await proposal.save();
      return proposal;
    }

    proposal.status = 'teacher_approved';
    // Auto-open project phase once a proposal is approved so student can proceed to Step 2.
    if (assignment && assignment.projectPhaseOpen === false) {
      assignment.projectPhaseOpen = true;
      await assignment.save();
    }
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
      select: 'title class subject semester academicYear',
      populate: [
        { path: 'class', select: 'code name' },
        { path: 'subject', select: 'code name' },
        { path: 'semester', select: 'name' },
        { path: 'academicYear', select: 'label' },
      ],
    })
    .sort({ updatedAt: -1 })
    .lean();

  const ids = list.map((p) => p._id);
  const withSub = ids.length
    ? await ProjectSubmission.distinct('proposal', { proposal: { $in: ids } })
    : [];
  const subSet = new Set(withSub.map(String));
  const studentUserIds = list
    .map((p) => p?.submittedBy?._id)
    .filter(Boolean);
  const profiles = studentUserIds.length
    ? await StudentProfile.find({ user: { $in: studentUserIds } }).select('user studentId').lean()
    : [];
  const studentIdByUser = new Map(profiles.map((sp) => [String(sp.user), sp.studentId || '']));

  return list.map((p) => ({
    ...p,
    hasProjectSubmission: subSet.has(String(p._id)),
    submittedBy: p.submittedBy
      ? {
          ...p.submittedBy,
          studentId: studentIdByUser.get(String(p.submittedBy._id)) || '',
        }
      : p.submittedBy,
  }));
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
  // Backward-compatible unlock: once teacher approves proposal, allow project phase
  // even if assignment.projectPhaseOpen was not toggled previously.
  if (!assignment?.projectPhaseOpen && prop.status === 'teacher_approved') {
    return { allowed: true, proposal: prop };
  }
  if (!assignment?.projectPhaseOpen) {
    return { allowed: false, reason: 'Project phase is not open yet.' };
  }
  return { allowed: true, proposal: prop };
}
