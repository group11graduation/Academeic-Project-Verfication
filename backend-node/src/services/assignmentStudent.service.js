import { Enrollment } from '../models/Enrollment.js';
import { Assignment } from '../models/Assignment.js';
import { Proposal } from '../models/Proposal.js';
import { resolveStoredProposalRecommendation } from './proposalWorkflow.service.js';
import { resolveSimilarMatchedProject } from './verifiedGallery.service.js';
import { Group } from '../models/Group.js';
import { ProjectSubmission } from '../models/ProjectSubmission.js';
import { isProjectDeadlineOpen } from './projectCodeSubmission.service.js';
import { isProposalFullyApprovedForProject } from './collaborativeProposalReview.service.js';
import { isDeadlinePassed } from './assignmentDeadline.service.js';
import { assignmentAcceptsStudentSubmissions } from './assignmentRequirements.service.js';
import { toProjectSubmissionClient } from './projectSubmissionSummary.service.js';
import { NormalAssignmentSubmission } from '../models/NormalAssignmentSubmission.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { Class } from '../models/Class.js';
import { PreviewSession } from '../models/PreviewSession.js';
import { TeacherProfile } from '../models/TeacherProfile.js';

function idOf(value) {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

function collectAssignmentTeacherIds(assignment) {
  const ids = new Set();
  for (const key of ['teacher', 'coTeacherId', 'frontendTeacherId', 'backendTeacherId']) {
    const v = assignment?.[key];
    if (v) ids.add(idOf(v));
  }
  return ids;
}

function enrichTeacherRef(userRef, profileByUser, roleLabel) {
  if (!userRef) return null;
  const uid = idOf(userRef);
  const profile = profileByUser.get(uid);
  const name = userRef.name || 'Teacher';
  const photo = String(userRef.photo || profile?.photo || '').trim();
  return {
    _id: uid,
    name,
    email: userRef.email || '',
    username: userRef.username || '',
    photo,
    department: profile?.department || '',
    employeeId: profile?.employeeId || '',
    roleLabel,
  };
}

function isDualTeacherAssignment(assignment) {
  if (assignment?.isCollaborative) return true;
  if (assignment?.coTeacherId) return true;
  if (assignment?.frontendTeacherId && assignment?.backendTeacherId) return true;
  if (assignment?.frontendTeacherId && assignment?.coTeacherId) return true;
  return false;
}

function buildTeachersForStudent(assignment, profileByUser) {
  const seen = new Set();
  const list = [];

  const add = (userRef, roleLabel) => {
    if (!userRef) return;
    const uid = idOf(userRef);
    if (seen.has(uid)) return;
    seen.add(uid);
    const row = enrichTeacherRef(userRef, profileByUser, roleLabel);
    if (row) list.push(row);
  };

  if (isDualTeacherAssignment(assignment)) {
    add(assignment.frontendTeacherId || assignment.teacher, 'Frontend teacher');
    add(assignment.backendTeacherId || assignment.coTeacherId, 'Backend teacher');
  } else {
    add(assignment.teacher, 'Teacher');
    if (assignment.coTeacherId) add(assignment.coTeacherId, 'Co-teacher');
  }

  return list;
}

function enrichAssignmentTeachers(assignment, profileByUser) {
  const teachers = buildTeachersForStudent(assignment, profileByUser);
  const primary = enrichTeacherRef(assignment.teacher, profileByUser, 'Teacher');
  return {
    ...assignment,
    teacher: primary || assignment.teacher,
    teachers,
  };
}

function normalizeAssignmentClasses(assignment) {
  const rawClasses = Array.isArray(assignment?.classes) && assignment.classes.length
    ? assignment.classes
    : assignment?.class
      ? [assignment.class]
      : [];
  const classes = rawClasses.filter(Boolean);
  return {
    ...assignment,
    classes,
    class: classes[0] || assignment?.class || null,
    classNames: classes.map((c) => [c?.code, c?.name].filter(Boolean).join(' - ')).filter(Boolean),
    assignedClasses: classes.map((c) => c?.code || c?.name).filter(Boolean),
  };
}

async function resolveStudentClassContexts(userId) {
  const enrollments = await Enrollment.find({ student: userId, status: 'active' })
    .populate('class', 'code name subjects')
    .populate('subjects', '_id code name')
    .lean();

  if (enrollments.length > 0) {
    const classIds = enrollments.map((e) => e.class?._id).filter(Boolean);
    const classRows = classIds.length
      ? await Class.find({ _id: { $in: classIds } }).populate('subjects', '_id code name').lean()
      : [];
    const classMap = new Map(classRows.map((c) => [String(c._id), c]));
    return enrollments.map((e) => {
      const cls = e.class?._id ? classMap.get(String(e.class._id)) || e.class : e.class;
      return { ...e, class: cls };
    });
  }

  // Fallback: some students are linked by StudentProfile.classCode but not Enrollment.
  const profile = await StudentProfile.findOne({ user: userId }).lean();
  const classCode = String(profile?.classCode || '').trim().toUpperCase();
  if (!classCode) return [];
  const cls = await Class.findOne({ code: classCode }).populate('subjects', '_id code name').lean();
  if (!cls) return [];
  return [
    {
      class: { _id: cls._id, code: cls.code, name: cls.name, subjects: cls.subjects || [] },
      // keep empty enrollment subjects to indicate "use class subjects fallback"
      subjects: [],
    },
  ];
}

export async function listAssignmentsWithProposalsForStudent(userId) {
  const enrollments = await resolveStudentClassContexts(userId);

  const orFilters = [];
  for (const e of enrollments) {
    const enrollmentSubjectIds = (e.subjects || [])
      .map((s) => (s?._id ? s._id : s))
      .filter(Boolean);
    // If enrollment has no subjects, fallback to class subjects.
    const classSubjectIds = (e.class?.subjects || []).map((s) => (s?._id ? s._id : s)).filter(Boolean);
    const subs = enrollmentSubjectIds.length ? enrollmentSubjectIds : classSubjectIds;
    for (const sid of subs) {
      orFilters.push({
        subject: sid,
        isActive: true,
        $or: [{ class: e.class._id }, { classes: e.class._id }],
      });
    }
  }
  if (!orFilters.length) return [];

  const assignments = await Assignment.find({ $or: orFilters })
    .populate('teacher', 'name email photo username')
    .populate('coTeacherId', 'name email photo username')
    .populate('frontendTeacherId', 'name email photo username')
    .populate('backendTeacherId', 'name email photo username')
    .populate('subject', 'code name')
    .populate('semester', 'name')
    .populate('academicYear', 'label')
    .populate('class', 'code name')
    .populate('classes', 'code name')
    .sort({ createdAt: -1 })
    .lean();

  const teacherIdSet = new Set();
  for (const a of assignments) {
    for (const tid of collectAssignmentTeacherIds(a)) teacherIdSet.add(tid);
  }
  const teacherProfiles = teacherIdSet.size
    ? await TeacherProfile.find({ user: { $in: [...teacherIdSet] } })
        .select('user department employeeId photo')
        .lean()
    : [];
  const profileByUser = new Map(teacherProfiles.map((p) => [String(p.user), p]));

  const out = [];
  for (const a of assignments) {
    const assignment = enrichAssignmentTeachers(normalizeAssignmentClasses(a), profileByUser);
    let proposal = await Proposal.findOne({
      assignment: assignment._id,
      submittedBy: userId,
      group: null,
    })
      .sort({ updatedAt: -1 })
      .lean();

    if (!proposal && assignment.submissionMode === 'group') {
      const groups = await Group.find({
        assignment: assignment._id,
        $or: [{ leader: userId }, { 'members.user': userId }],
      }).select('_id');
      const gids = groups.map((g) => g._id);
      if (gids.length) {
        proposal = await Proposal.findOne({ assignment: assignment._id, group: { $in: gids } })
          .sort({ updatedAt: -1 })
          .lean();
      }
    }

    const groupInfo =
      assignment.submissionMode === 'group'
        ? await Group.findOne({
            assignment: assignment._id,
            $or: [{ leader: userId }, { 'members.user': userId }],
          })
            .populate('leader', 'name email')
            .populate('members.user', 'name email')
            .lean()
        : null;

    const isLeader = groupInfo ? String(groupInfo.leader?._id || groupInfo.leader) === String(userId) : true;
    const approved = isProposalFullyApprovedForProject(proposal, assignment);
    const deadlineOpen = isProjectDeadlineOpen(assignment);
    const isNormal = String(assignment.assignmentType || 'normal') === 'normal';
    const proposalDeadlinePassed = isDeadlinePassed(assignment.proposalDeadline);
    const submissionDeadlinePassed = isDeadlinePassed(assignment.projectDeadline);
    const requirementsReady = assignmentAcceptsStudentSubmissions(assignment);

    let latestProjectSubmission = null;
    if (proposal?._id) {
      latestProjectSubmission = await ProjectSubmission.findOne({ proposal: proposal._id })
        .sort({ createdAt: -1 })
        .select(
          'originalFilename sizeBytes createdAt updatedAt version _id storedRelativePath teacherComment teacherScore teacherScoreMax teacherReviewedAt teacherPreviewedAt collaborativeProjectReviews'
        )
        .lean();
    }
    if (latestProjectSubmission) {
      latestProjectSubmission = toProjectSubmissionClient(latestProjectSubmission);
      if (!latestProjectSubmission.teacherPreviewedAt && proposal?._id) {
        const preview = await PreviewSession.findOne({
          proposal: proposal._id,
          status: { $in: ['running', 'stopped', 'expired'] },
        })
          .sort({ readyAt: -1, createdAt: -1 })
          .select('readyAt startedAt createdAt')
          .lean();
        if (preview) {
          latestProjectSubmission.teacherPreviewedAt =
            preview.readyAt || preview.startedAt || preview.createdAt || null;
        }
      }
    }
    const hasProjectSubmission = Boolean(latestProjectSubmission);
    const projectSubmissionAllowed =
      approved &&
      (assignment.submissionMode !== 'group' || isLeader) &&
      deadlineOpen &&
      (!!assignment.projectPhaseOpen || hasProjectSubmission);

    const latestNormalSubmission = String(assignment.assignmentType || 'normal') === 'normal'
      ? await NormalAssignmentSubmission.findOne({
          assignment: assignment._id,
          submittedBy: userId,
        })
          .sort({ createdAt: -1 })
          .select('originalFilename sizeBytes createdAt plagiarismScore plagiarismFlag plagiarismMethod')
          .lean()
      : null;

    let proposalOut = proposal || null;
    if (proposalOut?.status === 'ai_flagged_previous_semester') {
      const [rec, matchedSimilarProject] = await Promise.all([
        resolveStoredProposalRecommendation(proposalOut),
        resolveSimilarMatchedProject(proposalOut),
      ]);
      proposalOut = {
        ...proposalOut,
        recommendation: rec.recommendation,
        suggestedFeatures: rec.suggestedFeatures,
        matchedSimilarProject,
      };
    }

    out.push({
      assignment,
      proposal: proposalOut,
      group: groupInfo,
      isGroupLeader: isLeader,
      projectSubmissionAllowed,
      projectDeadline: assignment.projectDeadline || null,
      projectDeadlinePassed: !deadlineOpen,
      proposalDeadlinePassed,
      proposalSubmissionAllowed:
        !isNormal &&
        assignment.proposalPhaseOpen &&
        !proposalDeadlinePassed &&
        requirementsReady,
      canUpdateProjectUntilDeadline: approved && deadlineOpen,
      latestProjectSubmission,
      normalSubmissionAllowed: isNormal && !submissionDeadlinePassed && requirementsReady,
      submissionDeadlinePassed,
      latestNormalSubmission,
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

export async function getStudentAssignmentsOverview(userId) {
  const [rows, profile, enrollments] = await Promise.all([
    listAssignmentsWithProposalsForStudent(userId),
    StudentProfile.findOne({ user: userId }).populate('user', 'name email username').lean(),
    resolveStudentClassContexts(userId),
  ]);

  const currentEnrollment = enrollments[0] || null;

  const subjectMap = new Map();
  for (const enr of enrollments) {
    const enrollmentSubjects = enr.subjects || [];
    const classSubjects = enr.class?.subjects || [];
    const sourceSubjects = enrollmentSubjects.length ? enrollmentSubjects : classSubjects;
    for (const s of sourceSubjects) {
      if (!s?._id) continue;
      const key = String(s._id);
      if (!subjectMap.has(key)) {
        subjectMap.set(key, { _id: s._id, code: s.code || '', name: s.name || '' });
      }
    }
  }

  return {
    student: {
      userId,
      profileId: profile?._id || null,
      studentId: profile?.studentId || '',
      name: profile?.user?.name || '',
      email: profile?.user?.email || '',
      username: profile?.user?.username || '',
    },
    class: currentEnrollment?.class
      ? {
          _id: currentEnrollment.class._id,
          code: currentEnrollment.class.code || '',
          name: currentEnrollment.class.name || '',
        }
      : null,
    subjects: Array.from(subjectMap.values()),
    assignments: rows,
  };
}
