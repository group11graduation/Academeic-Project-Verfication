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
import { evaluateProposalAgainstAssignmentRequirements, evaluateRequirementBlock } from './requirementCheck.service.js';
import { assertAssignmentAcceptsStudentSubmissions, assignmentAcceptsStudentSubmissions, STUDENT_SUBMISSION_BLOCKED_MESSAGE } from './assignmentRequirements.service.js';
import { PROPOSAL_DEADLINE_PASSED_MESSAGE } from './assignmentDeadline.service.js';
import { parseStructuredProposalText } from '../utils/proposalFileParser.js';
import {
  buildCollaborativeApprovalMeta,
  getCollaborativeReviewState,
  isProposalFullyApprovedForProject,
  reconcileCollaborativeProposalStatus,
} from './collaborativeProposalReview.service.js';
import {
  distinctAssignmentIdsForTeacher,
  findAssignmentVisibleToTeacher,
  resolveCollaborativeReviewRole,
} from './teacherAssignmentAccess.service.js';

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

function uniqueFeatureList(features) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(features) ? features : []) {
    const value = String(raw || '').trim();
    if (!value) continue;
    const key = normalizeText(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

const DIFFERENTIATION_FEATURE_POOL = [
  'Role-based dashboards (admin vs user)',
  'Audit log of important user actions',
  'Email or in-app notifications',
  'Export reports (PDF or Excel)',
  'Two-factor authentication',
  'Real-time chat or messaging',
  'ML-based recommendation or prediction',
  'Integration with an external API',
  'Mobile-friendly progressive web app',
  'Multi-language interface',
  'Advanced search and filters',
  'Analytics dashboard for admins',
];

function buildProposalSearchBlob(title, description, features) {
  return normalizeText(
    [title, description, ...(Array.isArray(features) ? features : [])].filter(Boolean).join(' ')
  );
}

function isFeatureCoveredInProposal(feature, proposalBlob, currentFeatureSet) {
  const norm = normalizeText(feature);
  if (!norm) return true;
  if (currentFeatureSet.has(norm)) return true;
  if (proposalBlob.includes(norm)) return true;
  const tokens = norm.split(/\W+/).filter((t) => t.length > 3);
  if (tokens.length >= 2 && tokens.every((t) => proposalBlob.includes(t))) return true;
  return false;
}

function extractFeatureCandidatesFromText(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const out = [];
  const bulletLines = raw
    .split(/\n|[;•]/)
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter((line) => line.length >= 8 && line.length <= 120);
  for (const line of bulletLines) out.push(line);

  const capabilityPatterns = [
    /\b(?:user|admin|student|teacher)\s+(?:auth(?:entication)?|login|registration)\b/gi,
    /\b(?:search|filter|sort)(?:\s+\w+){0,3}\b/gi,
    /\b(?:dashboard|report|notification|chat|messaging)\b/gi,
    /\b(?:machine learning|ml|ai|recommendation|prediction)\b/gi,
    /\b(?:payment|checkout|invoice)\b/gi,
    /\b(?:export|import)\s+(?:pdf|excel|csv)\b/gi,
  ];
  for (const pattern of capabilityPatterns) {
    const matches = raw.match(pattern) || [];
    for (const m of matches) {
      const cleaned = String(m).trim();
      if (cleaned.length >= 4) out.push(cleaned);
    }
  }
  return uniqueFeatureList(out);
}

function buildMissingFeatureRecommendation({
  title = '',
  description = '',
  currentFeatures = [],
  matchedLegacyFeatures = [],
  matchedLegacyDescription = '',
}) {
  const proposalBlob = buildProposalSearchBlob(title, description, currentFeatures);
  const currentFeatureSet = new Set(
    (Array.isArray(currentFeatures) ? currentFeatures : [])
      .map((x) => normalizeText(x))
      .filter(Boolean)
  );

  const legacyCandidates = uniqueFeatureList([
    ...matchedLegacyFeatures,
    ...extractFeatureCandidatesFromText(matchedLegacyDescription),
  ]);

  const missingFromLegacy = legacyCandidates.filter(
    (f) => !isFeatureCoveredInProposal(f, proposalBlob, currentFeatureSet)
  );

  const missingDifferentiators = DIFFERENTIATION_FEATURE_POOL.filter(
    (f) => !isFeatureCoveredInProposal(f, proposalBlob, currentFeatureSet)
  );

  const suggestedFeatures = uniqueFeatureList([
    ...missingFromLegacy.slice(0, 5),
    ...missingDifferentiators.slice(0, Math.max(0, 5 - missingFromLegacy.length)),
  ]).slice(0, 6);

  if (!suggestedFeatures.length) {
    return {
      text: 'Your proposal already covers the main features from the similar previous project. You can still add one or two unique capabilities (workflow, roles, or AI) to stand out — optional, not required.',
      suggestedFeatures: [],
    };
  }

  if (missingFromLegacy.length) {
    return {
      text: `Optional: these features appeared in a similar previous-semester project but are missing from yours. You may add any of them (not required): ${suggestedFeatures.join('; ')}.`,
      suggestedFeatures,
    };
  }

  return {
    text: `Optional: add features that are not in your proposal yet to differentiate it (not required): ${suggestedFeatures.join('; ')}.`,
    suggestedFeatures,
  };
}

export async function resolveStoredProposalRecommendation(proposal) {
  if (!proposal || proposal.status !== 'ai_flagged_previous_semester') {
    return { recommendation: null, suggestedFeatures: [] };
  }

  const stored = uniqueFeatureList(proposal.aiSuggestedFeatures || []);
  if (stored.length || String(proposal.aiRecommendationText || '').trim()) {
    return {
      recommendation: String(proposal.aiRecommendationText || '').trim() || null,
      suggestedFeatures: stored,
    };
  }

  const matchedKey = proposal.aiMatchedLegacyId
    ? `legacy:${proposal.aiMatchedLegacyId}`
  : proposal.aiMatchedProposalId
    ? `proposal:${proposal.aiMatchedProposalId}`
    : '';

  let matchedLegacyFeatures = [];
  let matchedLegacyDescription = '';

  if (matchedKey.startsWith('legacy:')) {
    const legacy = await LegacyProject.findById(proposal.aiMatchedLegacyId)
      .select('features proposalDescription')
      .lean();
    if (legacy) {
      matchedLegacyFeatures = legacy.features || [];
      matchedLegacyDescription = legacy.proposalDescription || '';
    }
  } else if (matchedKey.startsWith('proposal:')) {
    const prev = await Proposal.findById(proposal.aiMatchedProposalId)
      .select('features description')
      .lean();
    if (prev) {
      matchedLegacyFeatures = prev.features || [];
      matchedLegacyDescription = prev.description || '';
    }
  }

  const built = buildMissingFeatureRecommendation({
    title: proposal.title,
    description: proposal.description,
    currentFeatures: proposal.features,
    matchedLegacyFeatures,
    matchedLegacyDescription,
  });

  return {
    recommendation: built.text,
    suggestedFeatures: built.suggestedFeatures,
  };
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

export async function parseUploadedProposalFile(file, { cleanup = false } = {}) {
  if (!file?.path) {
    const err = new Error('Proposal file is required');
    err.status = 400;
    throw err;
  }
  try {
    const rawText = await readProposalFileText(file);
    return parseStructuredProposalText(rawText);
  } finally {
    if (cleanup) {
      try {
        await fs.unlink(file.path);
      } catch {
        /* ignore cleanup errors */
      }
    }
  }
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
  let parsedFromFile = null;
  if (proposalFile) {
    const extractedText = await readProposalFileText(proposalFile);
    const parsed = parseStructuredProposalText(extractedText);
    parsedFromFile = parsed;
    // Always attempt extraction when a file is uploaded.
    // Prefer parsed file values; fallback to request body when a section is missing.
    title = parsed.title || String(title || '').trim();
    description = parsed.description || String(description || '').trim();
    features = (Array.isArray(parsed.features) && parsed.features.length)
      ? parsed.features
      : (Array.isArray(features) ? features : []);
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
  assertAssignmentAcceptsStudentSubmissions(assignment);
  if (assignment.proposalDeadline && new Date() > new Date(assignment.proposalDeadline)) {
    const err = new Error(PROPOSAL_DEADLINE_PASSED_MESSAGE);
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
        parsed: parsedFromFile,
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
    return { proposal, ai: null, parsed: parsedFromFile, message: 'Draft saved' };
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
      parsed: parsedFromFile,
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
  const legacyFeatureMap = new Map();
  const legacyDescriptionMap = new Map();
  for (const l of legacyDocs) {
    const key = `legacy:${l._id.toString()}`;
    legacyFeatureMap.set(key, uniqueFeatureList(l.features || []));
    legacyDescriptionMap.set(key, String(l.proposalDescription || ''));
  }
  for (const p of crossSemesterProposals) {
    const key = `proposal:${p._id.toString()}`;
    legacyFeatureMap.set(key, uniqueFeatureList(p.features || []));
    legacyDescriptionMap.set(key, String(p.description || ''));
  }

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
    proposal.collaborativeTeacherReviews = { frontend: {}, backend: {} };
  }

  let recommendation = null;
  let suggestedFeatures = [];

  if (verdict === 'warn_previous_semester') {
    const matchedKey = String(aiResult.matched_legacy_id || '').trim();
    const built = buildMissingFeatureRecommendation({
      title: proposal.title,
      description: proposal.description,
      currentFeatures: proposal.features,
      matchedLegacyFeatures: legacyFeatureMap.get(matchedKey) || [],
      matchedLegacyDescription: legacyDescriptionMap.get(matchedKey) || '',
    });
    recommendation = built.text;
    suggestedFeatures = built.suggestedFeatures;
    proposal.aiRecommendationText = built.text;
    proposal.aiSuggestedFeatures = built.suggestedFeatures;
  } else {
    proposal.aiRecommendationText = '';
    proposal.aiSuggestedFeatures = [];
  }

  await proposal.save();

  return {
    proposal,
    ai: aiResult,
    recommendation,
    suggestedFeatures,
    parsed: parsedFromFile,
    message:
      verdict === 'reject_same_semester'
        ? 'This proposal is too similar to another project in your current semester. Please change the idea, description, and features.'
        : verdict === 'warn_previous_semester'
          ? 'This idea resembles an approved project from a previous semester. You can optionally add new features to strengthen originality before teacher review.'
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

function emptyCollaborativeReviews() {
  return { frontend: {}, backend: {} };
}

function ensureCollaborativeReviews(proposal) {
  if (!proposal.collaborativeTeacherReviews) {
    proposal.collaborativeTeacherReviews = emptyCollaborativeReviews();
  }
  if (!proposal.collaborativeTeacherReviews.frontend) proposal.collaborativeTeacherReviews.frontend = {};
  if (!proposal.collaborativeTeacherReviews.backend) proposal.collaborativeTeacherReviews.backend = {};
}

function applyCollaborativeReviewSlot(proposal, role, teacherId, body, action) {
  ensureCollaborativeReviews(proposal);
  const slot = proposal.collaborativeTeacherReviews[role];
  slot.teacherId = teacherId;
  slot.action = action;
  slot.reviewedAt = new Date();
  if (body.comment !== undefined) slot.comment = body.comment == null ? '' : String(body.comment);
  if (Object.prototype.hasOwnProperty.call(body || {}, 'teacherProposalScore')) {
    const raw = body.teacherProposalScore;
    if (raw === null || raw === '' || raw === undefined) {
      slot.teacherProposalScore = null;
    } else {
      const n = Number(raw);
      if (!Number.isNaN(n) && n >= 0 && n <= 100) slot.teacherProposalScore = n;
    }
  }
  if (body.vsAi !== undefined && ['not_set', 'aligns', 'stricter', 'lenient'].includes(String(body.vsAi))) {
    slot.teacherVsAi = body.vsAi;
  }
}

function collaborativeApprovalComplete(proposal) {
  ensureCollaborativeReviews(proposal);
  return (
    proposal.collaborativeTeacherReviews.frontend?.action === 'approve' &&
    proposal.collaborativeTeacherReviews.backend?.action === 'approve'
  );
}

function assertCollaborativeReviewer(teacherId, assignment) {
  const role = resolveCollaborativeReviewRole(teacherId, assignment);
  if (!role) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  return role;
}

function assertSingleTeacherReviewer(teacherId, assignment) {
  const isPrimary = String(assignment.teacher?._id || assignment.teacher) === String(teacherId);
  const isCoTeacher =
    assignment.isCollaborative &&
    assignment.coTeacherId &&
    String(assignment.coTeacherId?._id || assignment.coTeacherId) === String(teacherId);
  if (!isPrimary && !isCoTeacher) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
}

/** Teacher actions */
export async function teacherReviewProposal(teacherId, proposalId, body) {
  const { action, comment, teacherProposalScore, vsAi } = body || {};
  const evalBody = { comment, teacherProposalScore, vsAi };
  const proposal = await Proposal.findById(proposalId).populate('assignment');
  if (!proposal) {
    const err = new Error('Proposal not found');
    err.status = 404;
    throw err;
  }

  const assignmentDoc = proposal.assignment;
  await reconcileCollaborativeProposalStatus(proposal, assignmentDoc);

  const isDualTeacherCollab = Boolean(assignmentDoc?.isCollaborative && assignmentDoc?.coTeacherId);
  let collaborativeRole = null;

  if (isDualTeacherCollab) {
    collaborativeRole = assertCollaborativeReviewer(teacherId, assignmentDoc);
  } else {
    assertSingleTeacherReviewer(teacherId, assignmentDoc);
  }

  if (action === 'comment') {
    applyTeacherEvalFields(proposal, evalBody);
    if (collaborativeRole) {
      applyCollaborativeReviewSlot(proposal, collaborativeRole, teacherId, evalBody, null);
    }
    await proposal.save();
    return enrichProposalCollaborativeMeta(proposal, assignmentDoc);
  }

  const reviewable = ['pending_teacher_approval'];
  const collabReviewState = getCollaborativeReviewState(proposal, assignmentDoc);
  const canReviewNow =
    reviewable.includes(proposal.status) ||
    collabReviewState.displayStatus === 'pending_teacher_approval' ||
    proposal.status === 'revision_required';
  if (!canReviewNow) {
    const err = new Error('Proposal is not awaiting teacher review in its current state');
    err.status = 400;
    throw err;
  }

  applyTeacherEvalFields(proposal, evalBody);

  if (isDualTeacherCollab && collaborativeRole) {
    if (action === 'reject') {
      applyCollaborativeReviewSlot(proposal, collaborativeRole, teacherId, evalBody, 'reject');
      proposal.status = 'teacher_rejected';
      await proposal.save();
      return enrichProposalCollaborativeMeta(proposal, assignmentDoc);
    }
    if (action === 'revision') {
      applyCollaborativeReviewSlot(proposal, collaborativeRole, teacherId, evalBody, 'revision');
      proposal.status = 'revision_required';
      proposal.collaborativeTeacherReviews = emptyCollaborativeReviews();
      await proposal.save();
      return enrichProposalCollaborativeMeta(proposal, assignmentDoc);
    }
    if (action === 'approve') {
      const block =
        collaborativeRole === 'frontend'
          ? assignmentDoc.frontendTechRequirements
          : assignmentDoc.backendTechRequirements;
      const blockLabel = collaborativeRole === 'frontend' ? 'Frontend' : 'Backend';
      const requirementCheck = evaluateRequirementBlock(block, proposal, blockLabel);

      proposal.requirementCheckPassed = requirementCheck.passed;
      proposal.requirementCheckSummary = requirementCheck.summary;
      proposal.requirementMissingKeywords = requirementCheck.missingKeywords;
      proposal.requirementAllowedTechMatched = requirementCheck.matchedAllowedTech;

      if (!requirementCheck.passed) {
        applyCollaborativeReviewSlot(proposal, collaborativeRole, teacherId, evalBody, 'reject');
        proposal.status = 'teacher_rejected';
        const prev = proposal.teacherComment || '';
        proposal.teacherComment = [prev, requirementCheck.summary].filter(Boolean).join(' | ');
        await proposal.save();
        return enrichProposalCollaborativeMeta(proposal, assignmentDoc);
      }

      applyCollaborativeReviewSlot(proposal, collaborativeRole, teacherId, evalBody, 'approve');

      if (collaborativeApprovalComplete(proposal)) {
        const fullCheck = evaluateProposalAgainstAssignmentRequirements(assignmentDoc, proposal);
        proposal.requirementCheckPassed = fullCheck.passed;
        proposal.requirementCheckSummary = fullCheck.summary;
        proposal.requirementMissingKeywords = fullCheck.missingKeywords;
        proposal.requirementAllowedTechMatched = fullCheck.matchedAllowedTech;

        if (!fullCheck.passed) {
          proposal.status = 'teacher_rejected';
          const prev = proposal.teacherComment || '';
          proposal.teacherComment = [prev, fullCheck.summary].filter(Boolean).join(' | ');
          await proposal.save();
          return enrichProposalCollaborativeMeta(proposal, assignmentDoc);
        }

        proposal.status = 'teacher_approved';
        const assignment = await Assignment.findById(assignmentDoc._id);
        if (assignment && assignment.projectPhaseOpen === false) {
          assignment.projectPhaseOpen = true;
          await assignment.save();
        }
      } else {
        proposal.status = 'pending_teacher_approval';
      }

      await proposal.save();
      return enrichProposalCollaborativeMeta(proposal, assignmentDoc);
    }

    const err = new Error('Invalid action');
    err.status = 400;
    throw err;
  }

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

function enrichProposalCollaborativeMeta(proposal, assignment) {
  const plain = proposal.toObject ? proposal.toObject() : { ...proposal };
  const meta = buildCollaborativeApprovalMeta(plain, assignment);
  return { ...plain, ...meta };
}

function mapProposalCollaborativeMeta(p, assignment) {
  return { ...p, ...buildCollaborativeApprovalMeta(p, assignment) };
}

export async function listProposalsForTeacher(teacherId, assignmentId) {
  let filter;
  if (assignmentId) {
    const a = await findAssignmentVisibleToTeacher(teacherId, assignmentId, { isActive: true });
    if (!a) return [];
    filter = { assignment: assignmentId };
  } else {
    const assignmentIds = await distinctAssignmentIdsForTeacher(teacherId, { isActive: true });
    filter = { assignment: { $in: assignmentIds } };
  }
  const list = await Proposal.find(filter)
    .populate('submittedBy', 'name email')
    .populate('group')
    .populate({
      path: 'assignment',
      select:
        'title class subject semester academicYear isCollaborative teacher coTeacherId frontendTeacherId backendTeacherId frontendTechRequirements backendTechRequirements',
      populate: [
        { path: 'class', select: 'code name' },
        { path: 'subject', select: 'code name' },
        { path: 'semester', select: 'name' },
        { path: 'academicYear', select: 'label' },
        { path: 'teacher', select: 'name email' },
        { path: 'coTeacherId', select: 'name email' },
        { path: 'frontendTeacherId', select: 'name email' },
        { path: 'backendTeacherId', select: 'name email' },
      ],
    })
    .sort({ updatedAt: -1 })
    .lean();

  for (const p of list) {
    if (p.assignment?.isCollaborative && p.status === 'teacher_approved') {
      const state = getCollaborativeReviewState(p, p.assignment);
      if (!state.dualComplete) {
        await Proposal.updateOne({ _id: p._id }, { status: 'pending_teacher_approval' });
        p.status = 'pending_teacher_approval';
      }
    }
  }

  const ids = list.map((p) => p._id);
  /** Latest project ZIP per proposal (for teacher download + preview UX) */
  const latestZipByProposal = new Map();
  if (ids.length) {
    const rows = await ProjectSubmission.aggregate([
      { $match: { proposal: { $in: ids } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$proposal', doc: { $first: '$$ROOT' } } },
    ]);
    for (const row of rows) {
      const d = row.doc;
      const rel = String(d.storedRelativePath || '').replace(/^\/+/, '');
      latestZipByProposal.set(String(row._id), {
        _id: d._id,
        originalFilename: d.originalFilename || '',
        sizeBytes: d.sizeBytes ?? 0,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        version: d.version ?? 1,
        downloadPath: rel ? `/uploads/${rel}` : '',
      });
    }
  }
  const studentUserIds = list
    .map((p) => p?.submittedBy?._id)
    .filter(Boolean);
  const profiles = studentUserIds.length
    ? await StudentProfile.find({ user: { $in: studentUserIds } }).select('user studentId').lean()
    : [];
  const studentIdByUser = new Map(profiles.map((sp) => [String(sp.user), sp.studentId || '']));

  return list.map((p) => {
    const latestProjectSubmission = latestZipByProposal.get(String(p._id)) || null;
    const row = {
    ...p,
    hasProjectSubmission: Boolean(latestProjectSubmission),
    latestProjectSubmission,
    submittedBy: p.submittedBy
      ? {
          ...p.submittedBy,
          studentId: studentIdByUser.get(String(p.submittedBy._id)) || '',
        }
      : p.submittedBy,
  };
    return mapProposalCollaborativeMeta(row, p.assignment);
  });
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
  if (!assignment) {
    return { allowed: false, reason: 'Assignment not found.' };
  }
  if (!assignmentAcceptsStudentSubmissions(assignment)) {
    return { allowed: false, reason: STUDENT_SUBMISSION_BLOCKED_MESSAGE };
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

  if (!prop || !isProposalFullyApprovedForProject(prop, assignment)) {
    return {
      allowed: false,
      reason: assignment?.isCollaborative
        ? 'Both frontend and backend teachers must approve your proposal before you can submit the project.'
        : 'Your proposal must be teacher-approved before you can submit the project.',
    };
  }

  if (assignment?.projectDeadline && new Date() > new Date(assignment.projectDeadline)) {
    return {
      allowed: false,
      reason: 'Project submission deadline has passed.',
      proposal: prop,
      projectDeadlinePassed: true,
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
  return {
    allowed: true,
    proposal: prop,
    projectDeadline: assignment?.projectDeadline || null,
    canUpdateUntilDeadline: true,
  };
}
