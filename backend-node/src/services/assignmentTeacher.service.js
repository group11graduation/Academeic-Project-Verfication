import mongoose from 'mongoose';
import { Assignment } from '../models/Assignment.js';
import { Group } from '../models/Group.js';
import { Class } from '../models/Class.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { Semester } from '../models/Semester.js';
import { Subject } from '../models/Subject.js';
import { Proposal } from '../models/Proposal.js';
import { ProjectSubmission } from '../models/ProjectSubmission.js';
import { LegacyProject } from '../models/LegacyProject.js';
import { toProjectSubmissionClient } from './projectSubmissionSummary.service.js';
import { countClassRosterStudents, syncAssignmentGroupsFromClassTemplates, memberSetKeyFromGroupLean, classTemplateDuplicatesAssignmentGroup, mapGroupMembersForTeacherCard } from './teacherClassGroups.service.js';
import {
  distinctAssignmentIdsForTeacher,
  findAssignmentVisibleToTeacher,
  resolveCollaborationRole,
  resolveCollaborativeReviewRole,
  teacherAssignmentVisibilityFilter,
  teacherCanManageAssignment,
} from './teacherAssignmentAccess.service.js';
import {
  assertAssignmentRequirementsConfigured,
  assertAssignmentTechnologyConsistent,
  validateAssignmentRequirementsConfig,
} from './assignmentRequirements.service.js';
import {
  validateDeadlinesOnCreate,
  validateDeadlinesOnUpdate,
} from './assignmentDeadline.service.js';

function normalizeAssignmentClasses(assignment, viewerTeacherId = null) {
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
    classAssignmentMode: assignment?.classAssignmentMode || (classes.length > 1 ? 'multiple' : 'single'),
    assignmentType: assignment?.assignmentType || 'normal',
    isCollaborative: Boolean(assignment?.isCollaborative),
    collaborationRole: viewerTeacherId ? resolveCollaborationRole(viewerTeacherId, assignment) : null,
    collaborationReviewRole: viewerTeacherId ? resolveCollaborativeReviewRole(viewerTeacherId, assignment) : null,
    primaryTeacherId: assignment?.teacher?._id || assignment?.teacher || null,
    frontendTeacherId: assignment?.frontendTeacherId?._id || assignment?.frontendTeacherId || null,
    backendTeacherId: assignment?.backendTeacherId?._id || assignment?.backendTeacherId || null,
    requirementsComplete: validateAssignmentRequirementsConfig({
      assignmentType: assignment?.assignmentType,
      requirementText: assignment?.requirementText,
      allowedTechnologies: assignment?.allowedTechnologies,
      assignmentFile: assignment?.assignmentFile,
      isCollaborative: assignment?.isCollaborative,
    }).ok,
  };
}

export function parseObjectIdList(value) {
  if (Array.isArray(value)) return value.map((x) => String(x || '').trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value.split(',').map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

/**
 * For assignments spanning multiple classes, all classes must share the same
 * semester and academic year so AI same-/cross-semester checks stay consistent.
 */
export function assertClassSemesterAlignment(classDocs) {
  if (!classDocs || classDocs.length <= 1) return;
  const sems = classDocs.map((c) => c.semester).filter(Boolean);
  const ays = classDocs.map((c) => c.academicYear).filter(Boolean);
  if (sems.length !== classDocs.length || ays.length !== classDocs.length) {
    const err = new Error(
      'When an assignment includes multiple classes, every class must have a semester and academic year set in admin (Class setup), or use a single class for this assignment.'
    );
    err.status = 400;
    throw err;
  }
  if (new Set(sems.map(String)).size > 1) {
    const err = new Error(
      'All selected classes must be in the same semester. Unify semester in admin or select classes from one term only.'
    );
    err.status = 400;
    throw err;
  }
  if (new Set(ays.map(String)).size > 1) {
    const err = new Error('All selected classes must belong to the same academic year.');
    err.status = 400;
    throw err;
  }
}

function mapSubjectOption(subject) {
  if (!subject) return null;
  const id = subject._id || subject;
  if (!id) return null;
  return {
    _id: id,
    code: subject.code || '',
    name: subject.name || '',
  };
}

/** All subjects a teacher may pick when creating an assignment for this class. */
function resolveCatalogSubjects(classDoc, teacherAssignment) {
  const classSubjects = (classDoc?.subjects || []).map(mapSubjectOption).filter(Boolean);
  const teacherSubjects = (teacherAssignment?.subjects || []).map(mapSubjectOption).filter(Boolean);
  if (classSubjects.length > 0) return classSubjects;

  const merged = new Map();
  for (const s of teacherSubjects) merged.set(String(s._id), s);
  return [...merged.values()];
}

export function teacherCanUseSubject(classDoc, teacherAssignment, subjectId) {
  const sid = String(subjectId);
  const classIds = new Set((classDoc?.subjects || []).map((s) => String(s?._id || s)));
  const teacherIds = new Set((teacherAssignment?.subjects || []).map((s) => String(s?._id || s)));
  if (classIds.has(sid)) return true;
  if (teacherIds.has(sid)) return true;
  return false;
}

export async function listClassesForTeacher(teacherId) {
  const tid = new mongoose.Types.ObjectId(teacherId);
  const classes = await Class.find({ 'teacherAssignments.teacher': tid }).lean();

  const rows = await Promise.all(
    classes.map(async (c) => {
      const students = await countClassRosterStudents(c);
      return {
        _id: c._id,
        code: c.code,
        title: c.name,
        section: 'A',
        students,
      };
    })
  );
  return rows;
}

export async function getClassDetailsForTeacher(teacherId, classCodeOrId) {
  const tid = new mongoose.Types.ObjectId(teacherId);
  const raw = String(classCodeOrId || '').trim();
  if (!raw) return null;

  const byCode = raw.toUpperCase();
  const classQuery = mongoose.Types.ObjectId.isValid(raw)
    ? { _id: raw, 'teacherAssignments.teacher': tid }
    : { code: byCode, 'teacherAssignments.teacher': tid };

  const cls = await Class.findOne(classQuery)
    .populate('semester', 'name')
    .populate('academicYear', 'label')
    .lean();
  if (!cls) return null;

  const studentCount = await countClassRosterStudents(cls);
  const assignmentIds = await Assignment.find({
    teacher: tid,
    isActive: true,
    $or: [{ class: cls._id }, { classes: cls._id }],
  }).distinct('_id');

  let projectsSubmitted = 0;
  let similarityAlerts = 0;
  let pendingReviews = 0;
  if (assignmentIds.length > 0) {
    [projectsSubmitted, similarityAlerts, pendingReviews] = await Promise.all([
      ProjectSubmission.countDocuments({ assignment: { $in: assignmentIds } }),
      Proposal.countDocuments({
        assignment: { $in: assignmentIds },
        status: { $in: ['ai_rejected_same_semester', 'ai_flagged_previous_semester', 'requirements_rejected'] },
      }),
      Proposal.countDocuments({
        assignment: { $in: assignmentIds },
        status: 'pending_teacher_approval',
      }),
    ]);
  }

  const semesterLabel = cls.semester?.name ? String(cls.semester.name) : '';
  const academicYearLabel = cls.academicYear?.label ? String(cls.academicYear.label) : '';

  return {
    _id: cls._id,
    code: cls.code,
    title: cls.name || cls.code,
    description: cls.description || '',
    faculty: cls.faculty || '',
    department: cls.department || '',
    category: cls.category || '',
    section: 'A',
    studentCount,
    projectsSubmitted,
    similarityAlerts,
    pendingReviews,
    semesterLabel,
    academicYearLabel,
    timing:
      semesterLabel && academicYearLabel
        ? `${academicYearLabel} • ${semesterLabel}`
        : semesterLabel || academicYearLabel || 'CURRENT TERM',
    createdAt: cls.createdAt,
    updatedAt: cls.updatedAt,
  };
}

export async function listAssignmentsForTeacher(teacherId, { semesterId: semesterFilter } = {}) {
  const q = teacherAssignmentVisibilityFilter(teacherId, { isActive: true });
  if (semesterFilter && mongoose.Types.ObjectId.isValid(String(semesterFilter))) {
    q.semester = new mongoose.Types.ObjectId(String(semesterFilter));
  }
  const rows = await Assignment.find(q)
    .populate('class', 'code name')
    .populate('classes', 'code name')
    .populate('subject', 'code name')
    .populate('semester', 'name')
    .populate('academicYear', 'label')
    .populate('teacher', 'name email')
    .populate('coTeacherId', 'name email')
    .sort({ createdAt: -1 })
    .lean();
  return rows.map((row) => normalizeAssignmentClasses(row, teacherId));
}

export async function getAssignmentForTeacher(teacherId, assignmentId) {
  const a = await Assignment.findOne(teacherAssignmentVisibilityFilter(teacherId, { _id: assignmentId }))
    .populate('class')
    .populate('classes')
    .populate('subject')
    .populate('semester')
    .populate('academicYear')
    .populate('teacher', 'name email')
    .populate('coTeacherId', 'name email')
    .populate('frontendTeacherId', 'name email')
    .populate('backendTeacherId', 'name email')
    .lean();
  return a ? normalizeAssignmentClasses(a, teacherId) : null;
}

export async function getTeacherCatalog(teacherId) {
  const tid = new mongoose.Types.ObjectId(teacherId);
  const classes = await Class.find({ 'teacherAssignments.teacher': tid })
    .populate('teacherAssignments.subjects')
    .populate('subjects')
    .populate('academicYear')
    .populate('semester')
    .lean();

  return classes.map((c) => {
    const ta = c.teacherAssignments?.find((x) => tid.equals(x.teacher));
    return {
      class: { _id: c._id, code: c.code, name: c.name },
      subjects: resolveCatalogSubjects(c, ta),
      academicYear: c.academicYear,
      semester: c.semester,
    };
  });
}

export async function createAssignment(teacherId, payload) {
  const {
    classId,
    classIds,
    subjectId,
    semesterId,
    academicYearId,
    title,
    description,
    submissionMode,
    groupModeType,
    maxGroupSize,
    proposalPhaseOpen,
    projectPhaseOpen,
    proposalDeadline,
    projectDeadline,
    assignmentType,
    classAssignmentMode,
  } = payload;

  const selectedClassIds = [...new Set(parseObjectIdList(classIds).concat(classId ? [String(classId)] : []))];
  if (!selectedClassIds.length) {
    const err = new Error('At least one class is required');
    err.status = 400;
    throw err;
  }

  const normalizedClassAssignmentMode =
    String(classAssignmentMode || (selectedClassIds.length > 1 ? 'multiple' : 'single')).trim().toLowerCase() === 'multiple'
      ? 'multiple'
      : 'single';
  if (normalizedClassAssignmentMode === 'single' && selectedClassIds.length > 1) {
    const err = new Error('Single class assignment mode allows only one class');
    err.status = 400;
    throw err;
  }

  const tid = new mongoose.Types.ObjectId(teacherId);
  const classDocsRaw = await Class.find({ _id: { $in: selectedClassIds } })
    .populate('teacherAssignments.subjects')
    .populate('subjects');
  const classDocs = selectedClassIds
    .map((id) => classDocsRaw.find((doc) => String(doc._id) === String(id)))
    .filter(Boolean);
  if (classDocs.length !== selectedClassIds.length) {
    const err = new Error('One or more selected classes were not found');
    err.status = 404;
    throw err;
  }
  for (const classDoc of classDocs) {
    const ta = classDoc.teacherAssignments?.find((x) => tid.equals(x.teacher));
    if (!ta) {
      const err = new Error(`You are not assigned to teach class ${classDoc.code || classDoc.name || ''}`.trim());
      err.status = 403;
      throw err;
    }
    if (!teacherCanUseSubject(classDoc, ta, subjectId)) {
      const err = new Error(`This subject is not linked to class ${classDoc.code || classDoc.name || ''}`.trim());
      err.status = 403;
      throw err;
    }
  }

  assertClassSemesterAlignment(classDocs);

  const primaryClassDoc = classDocs[0];
  const semesterResolved = semesterId || primaryClassDoc.semester || null;
  let academicYearResolved = academicYearId || primaryClassDoc.academicYear || null;
  if (!academicYearResolved && semesterResolved) {
    const sem = await Semester.findById(semesterResolved).lean();
    academicYearResolved = sem?.academicYear || null;
  }
  if (!semesterResolved) {
    const err = new Error('semesterId is required for assignment');
    err.status = 400;
    throw err;
  }
  if (!academicYearResolved) {
    const err = new Error('academicYear is required; assign class semester/academic year first');
    err.status = 400;
    throw err;
  }
  if (semesterId && primaryClassDoc.semester && String(semesterResolved) !== String(semesterId)) {
    const err = new Error('semesterId does not match the selected class semester(s)');
    err.status = 400;
    throw err;
  }

  const parseList = (v) => {
    if (Array.isArray(v)) return v.map((x) => String(x || '').trim()).filter(Boolean);
    if (typeof v === 'string') return v.split(',').map((x) => x.trim()).filter(Boolean);
    return [];
  };
  const parseBool = (v, fallback = false) => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') {
      if (v.toLowerCase() === 'true') return true;
      if (v.toLowerCase() === 'false') return false;
    }
    return fallback;
  };

  const assignmentTypeResolved =
    String(assignmentType || 'normal').trim().toLowerCase() === 'final' ? 'final' : 'normal';
  const requirementTextResolved = String(payload.requirementText || '').trim();
  const allowedTechnologiesResolved = parseList(payload.allowedTechnologies || payload.allowedTechnologiesText);
  const assignmentFileResolved = payload._requirementsFilePath || '';

  assertAssignmentRequirementsConfigured({
    assignmentType: assignmentTypeResolved,
    requirementText: requirementTextResolved,
    allowedTechnologies: allowedTechnologiesResolved,
    assignmentFile: assignmentFileResolved,
  });

  const subjectDoc = await Subject.findById(subjectId).select('name code').lean();
  assertAssignmentTechnologyConsistent({
    subject: subjectDoc,
    title: title?.trim() || '',
    description: description?.trim() || '',
    requirementText: requirementTextResolved,
    allowedTechnologies: allowedTechnologiesResolved,
  });

  validateDeadlinesOnCreate({
    assignmentType: assignmentTypeResolved,
    proposalDeadline,
    projectDeadline,
  });

  const doc = new Assignment({
    teacher: teacherId,
    class: primaryClassDoc._id,
    classes: classDocs.map((c) => c._id),
    subject: subjectId,
    semester: semesterResolved,
    academicYear: academicYearResolved,
    title: title?.trim(),
    description: description?.trim() || '',
    requirementText: requirementTextResolved,
    requiredKeywords: parseList(payload.requiredKeywords || payload.requiredKeywordsText),
    allowedTechnologies: allowedTechnologiesResolved,
    assignmentFile: assignmentFileResolved,
    originalFileName: payload._requirementsOriginalName || '',
    assignmentType: assignmentTypeResolved,
    classAssignmentMode: normalizedClassAssignmentMode,
    submissionMode: submissionMode || 'single',
    groupModeType: groupModeType || 'teacher_manual',
    maxGroupSize: maxGroupSize || 4,
    proposalPhaseOpen: parseBool(proposalPhaseOpen, true),
    projectPhaseOpen: parseBool(projectPhaseOpen, false),
    proposalDeadline: proposalDeadline ? new Date(proposalDeadline) : null,
    projectDeadline: projectDeadline ? new Date(projectDeadline) : null,
  });
  await doc.save();
  if (doc.submissionMode === 'group') {
    try {
      await syncAssignmentGroupsFromClassTemplates(teacherId, doc._id, { onlyIfEmpty: true });
    } catch {
      /* non-fatal: assignment still created */
    }
  }
  return getAssignmentForTeacher(teacherId, doc._id);
}

export async function updateAssignment(teacherId, assignmentId, payload) {
  const assignment = await Assignment.findOne({ _id: assignmentId, teacher: teacherId, isActive: true });
  if (!assignment) {
    const err = new Error('Assignment not found or you are not the primary teacher');
    err.status = 404;
    throw err;
  }

  const prevSubmissionMode = assignment.submissionMode;

  const nextClassIds = [...new Set(parseObjectIdList(payload.classIds).concat(payload.classId ? [String(payload.classId)] : []))];
  if (!nextClassIds.length) {
    const err = new Error('At least one class is required');
    err.status = 400;
    throw err;
  }

  const normalizedClassAssignmentMode =
    String(payload.classAssignmentMode || (nextClassIds.length > 1 ? 'multiple' : 'single')).trim().toLowerCase() === 'multiple'
      ? 'multiple'
      : 'single';
  if (normalizedClassAssignmentMode === 'single' && nextClassIds.length > 1) {
    const err = new Error('Single class assignment mode allows only one class');
    err.status = 400;
    throw err;
  }

  const tid = new mongoose.Types.ObjectId(teacherId);
  const classDocsRaw = await Class.find({ _id: { $in: nextClassIds } })
    .populate('teacherAssignments.subjects')
    .populate('subjects');
  const classDocs = nextClassIds
    .map((id) => classDocsRaw.find((doc) => String(doc._id) === String(id)))
    .filter(Boolean);
  if (classDocs.length !== nextClassIds.length) {
    const err = new Error('One or more selected classes were not found');
    err.status = 404;
    throw err;
  }
  for (const classDoc of classDocs) {
    const ta = classDoc.teacherAssignments?.find((x) => tid.equals(x.teacher));
    if (!ta) {
      const err = new Error(`You are not assigned to teach class ${classDoc.code || classDoc.name || ''}`.trim());
      err.status = 403;
      throw err;
    }
  }

  assertClassSemesterAlignment(classDocs);

  const parseList = (v, fallback = []) => {
    if (Array.isArray(v)) return v.map((x) => String(x || '').trim()).filter(Boolean);
    if (typeof v === 'string') return v.split(',').map((x) => x.trim()).filter(Boolean);
    return fallback;
  };
  const parseBool = (v, fallback) => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') {
      if (v.toLowerCase() === 'true') return true;
      if (v.toLowerCase() === 'false') return false;
    }
    return fallback;
  };

  const nextSubjectId = payload.subjectId ? String(payload.subjectId) : String(assignment.subject);
  for (const classDoc of classDocs) {
    const ta = classDoc.teacherAssignments?.find((x) => tid.equals(x.teacher));
    if (!ta) continue;
    if (!teacherCanUseSubject(classDoc, ta, nextSubjectId)) {
      const err = new Error(`Subject is not linked to class ${classDoc.code || classDoc.name || ''}`.trim());
      err.status = 403;
      throw err;
    }
  }
  assignment.subject = nextSubjectId;

  assignment.class = classDocs[0]._id;
  assignment.classes = classDocs.map((c) => c._id);
  if (typeof payload.title === 'string') assignment.title = payload.title.trim();
  if (typeof payload.description === 'string') assignment.description = payload.description.trim();
  if (typeof payload.requirementText === 'string') assignment.requirementText = payload.requirementText.trim();
  if ('requiredKeywords' in payload || 'requiredKeywordsText' in payload) {
    assignment.requiredKeywords = parseList(payload.requiredKeywords || payload.requiredKeywordsText);
  }
  if ('allowedTechnologies' in payload || 'allowedTechnologiesText' in payload) {
    assignment.allowedTechnologies = parseList(payload.allowedTechnologies || payload.allowedTechnologiesText);
  }
  if (typeof payload.submissionMode === 'string') assignment.submissionMode = payload.submissionMode;
  if (typeof payload.assignmentType === 'string') {
    const nextType = payload.assignmentType.trim().toLowerCase() === 'final' ? 'final' : 'normal';
    assignment.assignmentType = nextType;
    if (nextType === 'normal' && !('submissionMode' in payload)) {
      assignment.submissionMode = 'single';
    }
  }
  assignment.classAssignmentMode = normalizedClassAssignmentMode;
  if (typeof payload.groupModeType === 'string') assignment.groupModeType = payload.groupModeType;
  if (payload.maxGroupSize !== undefined && payload.maxGroupSize !== null && payload.maxGroupSize !== '') {
    assignment.maxGroupSize = Number(payload.maxGroupSize);
  }
  if ('proposalPhaseOpen' in payload) assignment.proposalPhaseOpen = parseBool(payload.proposalPhaseOpen, assignment.proposalPhaseOpen);
  if ('projectPhaseOpen' in payload) assignment.projectPhaseOpen = parseBool(payload.projectPhaseOpen, assignment.projectPhaseOpen);

  validateDeadlinesOnUpdate(assignment, payload);

  if ('proposalDeadline' in payload) assignment.proposalDeadline = payload.proposalDeadline ? new Date(payload.proposalDeadline) : null;
  if ('projectDeadline' in payload) assignment.projectDeadline = payload.projectDeadline ? new Date(payload.projectDeadline) : null;

  assertAssignmentRequirementsConfigured({
    assignmentType: assignment.assignmentType,
    requirementText: assignment.requirementText,
    allowedTechnologies: assignment.allowedTechnologies,
    assignmentFile: assignment.assignmentFile,
    isCollaborative: assignment.isCollaborative,
  });

  const subjectDoc = await Subject.findById(assignment.subject).select('name code').lean();
  assertAssignmentTechnologyConsistent({
    subject: subjectDoc,
    title: assignment.title || '',
    description: assignment.description || '',
    requirementText: assignment.requirementText || '',
    allowedTechnologies: assignment.allowedTechnologies || [],
    isCollaborative: assignment.isCollaborative,
  });

  await assignment.save();
  if (assignment.submissionMode === 'group' && prevSubmissionMode !== 'group') {
    try {
      await syncAssignmentGroupsFromClassTemplates(teacherId, assignment._id, { onlyIfEmpty: true });
    } catch {
      /* non-fatal */
    }
  }
  return getAssignmentForTeacher(teacherId, assignment._id);
}

export async function attachRequirementsFile(teacherId, assignmentId, file) {
  if (!file?.filename) {
    const err = new Error('No requirements file uploaded');
    err.status = 400;
    throw err;
  }
  const a = await findAssignmentVisibleToTeacher(teacherId, assignmentId, { isActive: true });
  if (!a || !teacherCanManageAssignment(teacherId, a)) {
    const err = new Error('Assignment not found or you are not the primary teacher');
    err.status = 404;
    throw err;
  }
  a.assignmentFile = `/uploads/assignment-requirements/${file.filename}`;
  a.originalFileName = file.originalname || file.filename;
  await a.save();
  return getAssignmentForTeacher(teacherId, assignmentId);
}

export async function createGroupForAssignment(teacherId, assignmentId, { name, leaderUserId, memberUserIds }) {
  const a = await findAssignmentVisibleToTeacher(teacherId, assignmentId, { isActive: true });
  if (!a) {
    const err = new Error('Assignment not found');
    err.status = 404;
    throw err;
  }
  if (a.submissionMode !== 'group') {
    const err = new Error('This assignment is not in group mode');
    err.status = 400;
    throw err;
  }
  const leader = new mongoose.Types.ObjectId(leaderUserId);
  const memberIds = new Set((memberUserIds || []).map((id) => String(id)));
  memberIds.delete(String(leaderUserId));
  const members = [...memberIds].map((id) => ({ user: new mongoose.Types.ObjectId(id) }));
  const group = new Group({
    assignment: a._id,
    name: name?.trim() || 'Group',
    leader,
    members,
  });
  await group.save();
  return group.populate('leader', 'name email');
}

export async function listGroupsForAssignment(teacherId, assignmentId) {
  const a = await findAssignmentVisibleToTeacher(teacherId, assignmentId, { isActive: true });
  if (!a) {
    const err = new Error('Assignment not found');
    err.status = 404;
    throw err;
  }
  return Group.find({ assignment: assignmentId })
    .populate('leader', 'name email')
    .populate('members.user', 'name email')
    .lean();
}

export async function getTeacherDashboardStats(teacherId) {
  const classes = await listClassesForTeacher(teacherId);
  const assignmentIds = await distinctAssignmentIdsForTeacher(teacherId, { isActive: true });
  const [pendingReviews, reviewed, similarityAlerts] = assignmentIds.length
    ? await Promise.all([
        Proposal.countDocuments({ assignment: { $in: assignmentIds }, status: 'pending_teacher_approval' }),
        Proposal.countDocuments({
          assignment: { $in: assignmentIds },
          status: { $in: ['teacher_approved', 'teacher_rejected', 'revision_required'] },
        }),
        Proposal.countDocuments({
          assignment: { $in: assignmentIds },
          status: { $in: ['ai_rejected_same_semester', 'ai_flagged_previous_semester', 'requirements_rejected'] },
        }),
      ])
    : [0, 0, 0];

  const activeClasses = await Promise.all(
    classes.slice(0, 8).map(async (cls) => {
      const classAssignmentIds = await Assignment.find(
        teacherAssignmentVisibilityFilter(teacherId, {
          isActive: true,
          $or: [{ class: cls._id }, { classes: cls._id }],
        })
      ).distinct('_id');
      const pending = classAssignmentIds.length
        ? await Proposal.countDocuments({ assignment: { $in: classAssignmentIds }, status: 'pending_teacher_approval' })
        : 0;
      return { ...cls, pending };
    })
  );

  return {
    totalProjectsReviewed: reviewed,
    pendingReviews,
    similarityAlerts,
    activeClasses,
  };
}

export async function softDeleteAssignmentForTeacher(teacherId, assignmentId) {
  const assignment = await Assignment.findOne({ _id: assignmentId, teacher: teacherId, isActive: true });
  if (!assignment) {
    const err = new Error('Assignment not found');
    err.status = 404;
    throw err;
  }
  assignment.isActive = false;
  await assignment.save();
  return { _id: assignment._id, isActive: assignment.isActive };
}

export async function listAllGroupsForTeacher(teacherId) {
  const tid = new mongoose.Types.ObjectId(teacherId);
  const teacherClasses = await Class.find({ 'teacherAssignments.teacher': tid }).select('_id code name').lean();
  const classMetaById = new Map(teacherClasses.map((c) => [String(c._id), c]));

  const assignments = await Assignment.find(teacherAssignmentVisibilityFilter(teacherId, { isActive: true }))
    .populate('class', 'code name')
    .populate('subject', 'code name')
    .populate('coTeacherId', 'name email')
    .lean();

  const assignmentIds = assignments.map((a) => a._id);
  const assignmentMap = new Map(assignments.map((a) => [String(a._id), a]));

  const templateGroups =
    teacherClasses.length > 0
      ? await Group.find({
          assignment: null,
          hostClass: { $in: teacherClasses.map((c) => c._id) },
        })
          .populate('leader', 'name photo')
          .populate('members.user', 'name photo')
          .lean()
      : [];

  const [groups, proposals] =
    assignmentIds.length > 0
      ? await Promise.all([
          Group.find({ assignment: { $in: assignmentIds } })
            .populate('leader', 'name photo')
            .populate('members.user', 'name photo')
            .lean(),
          Proposal.find({ assignment: { $in: assignmentIds } }).lean(),
        ])
      : [[], []];

  const proposalByGroup = new Map(
    proposals
      .filter((p) => p.group)
      .map((p) => [String(p.group), p])
  );

  const memberUserIds = [...groups, ...templateGroups]
    .flatMap((g) => [g.leader, ...(g.members || []).map((m) => m.user)])
    .map((u) => String(u?._id || u))
    .filter(Boolean);
  const memberProfiles = memberUserIds.length
    ? await StudentProfile.find({ user: { $in: memberUserIds } }).select('user studentId').lean()
    : [];
  const studentIdByUser = new Map(memberProfiles.map((p) => [String(p.user), p.studentId || '']));

  const groupedByClass = new Map();
  const assignmentGroupsByClassId = new Map();
  const seenAssignmentMemberKeysByClass = new Map();

  function ensureBucket(classCode, title) {
    if (!groupedByClass.has(classCode)) {
      groupedByClass.set(classCode, {
        code: classCode,
        title: title || classCode,
        semester: '',
        projects: [],
      });
    }
    return groupedByClass.get(classCode);
  }

  for (const group of groups) {
    const assignment = assignmentMap.get(String(group.assignment));
    if (!assignment) continue;
    const classIds = [
      assignment.class?._id,
      ...(Array.isArray(assignment.classes) ? assignment.classes.map((c) => c?._id || c) : []),
    ]
      .filter(Boolean)
      .map(String);
    for (const cid of classIds) {
      if (!assignmentGroupsByClassId.has(cid)) assignmentGroupsByClassId.set(cid, []);
      assignmentGroupsByClassId.get(cid).push(group);
    }
  }

  for (const group of templateGroups) {
    const hcId = String(group.hostClass || '');
    const clsMeta = classMetaById.get(hcId);
    if (!clsMeta) continue;
    const assignmentGroupsForClass = assignmentGroupsByClassId.get(hcId) || [];
    if (classTemplateDuplicatesAssignmentGroup(group, assignmentGroupsForClass)) continue;

    const classCode = clsMeta.code || clsMeta.name || 'CLASS';
    const bucket = ensureBucket(classCode, clsMeta.name || classCode);
    const members = mapGroupMembersForTeacherCard(group, studentIdByUser);
    bucket.projects.push({
      _id: group._id,
      title: group.name || 'Class team',
      members,
      type: 'group',
      assignmentNumber: String(group._id).slice(-4).toUpperCase(),
      status: 'class_team',
      similarity: 0,
      similarityLevel: 'Low',
      isClassTeamTemplate: true,
    });
  }

  for (const group of groups) {
    const assignment = assignmentMap.get(String(group.assignment));
    if (!assignment) continue;
    const classCode = assignment.class?.code || assignment.class?.name || 'CLASS';
    const memberKey = memberSetKeyFromGroupLean(group);
    if (memberKey) {
      if (!seenAssignmentMemberKeysByClass.has(classCode)) {
        seenAssignmentMemberKeysByClass.set(classCode, new Set());
      }
      const seen = seenAssignmentMemberKeysByClass.get(classCode);
      if (seen.has(memberKey)) continue;
      seen.add(memberKey);
    }
    const bucket = ensureBucket(classCode, assignment.class?.name || classCode);
    const proposal = proposalByGroup.get(String(group._id));
    const members = mapGroupMembersForTeacherCard(group, studentIdByUser);
    const similarity = Math.round(Number(proposal?.aiPreviousSemesterMaxScore || proposal?.aiSameSemesterMaxScore || 0) * 100);
    bucket.projects.push({
      _id: group._id,
      title: proposal?.title || assignment.title || group.name || 'Project',
      members,
      type: assignment.submissionMode === 'single' ? 'individual' : 'group',
      assignmentNumber: String(group._id).slice(-4).toUpperCase(),
      status: proposal?.status || 'draft',
      similarity,
      similarityLevel: similarity >= 58 ? 'High' : 'Low',
    });
  }

  return Array.from(groupedByClass.values());
}

function buildProposalPlainText(proposal) {
  if (!proposal) return '';
  const parts = [];
  parts.push(`PROJECT TITLE\n${proposal.title || '—'}`);
  parts.push(`\n\nOVERVIEW\n${String(proposal.description || '').trim() || 'No overview provided.'}`);
  if (Array.isArray(proposal.features) && proposal.features.length) {
    parts.push('\n\nPROPOSED FUNCTIONALITY');
    for (const f of proposal.features) parts.push(`\n• ${f}`);
  }
  if (proposal.requirementCheckSummary && proposal.requirementCheckPassed === false) {
    parts.push(`\n\nREQUIREMENT CHECK\n${proposal.requirementCheckSummary}`);
  }
  if (proposal.aiSummary) {
    parts.push(`\n\nAI SUMMARY (ADVISORY)\n${proposal.aiSummary}`);
  }
  return parts.join('');
}

function buildGroupReviewChecklist(proposal, projectSubmission) {
  const items = [];
  if (proposal) {
    const overviewOk = String(proposal.description || '').trim().length >= 40;
    items.push({
      label: 'Abstract & introduction',
      desc: overviewOk ? 'Overview provided' : 'Overview missing or too short',
      checked: overviewOk,
    });
    const featureCount = Array.isArray(proposal.features) ? proposal.features.length : 0;
    items.push({
      label: 'Proposed functionality',
      desc: featureCount > 0 ? `${featureCount} feature(s) listed` : 'No features listed yet',
      checked: featureCount > 0,
    });
    items.push({
      label: 'Assignment requirements',
      desc:
        proposal.requirementCheckPassed === false
          ? proposal.requirementCheckSummary || 'Requirements not met'
          : 'Requirements check passed',
      checked: proposal.requirementCheckPassed !== false,
    });
    const approved = proposal.status === 'teacher_approved';
    items.push({
      label: 'Teacher proposal review',
      desc: approved
        ? 'Approved'
        : String(proposal.status || 'draft').replace(/_/g, ' '),
      checked: approved,
    });
  }
  if (projectSubmission) {
    items.push({
      label: 'Project submission',
      desc: projectSubmission.originalFilename || 'Project ZIP uploaded',
      checked: true,
    });
  }
  return items;
}

function deriveSimilarityVerdict(proposal) {
  const status = String(proposal?.status || '');
  if (status === 'ai_rejected_same_semester') return 'reject_same_semester';
  if (status === 'ai_flagged_previous_semester') return 'warn_previous_semester';
  const same = Number(proposal?.aiSameSemesterMaxScore || 0);
  const legacy = Number(proposal?.aiPreviousSemesterMaxScore || 0);
  if (same >= 0.85) return 'reject_same_semester';
  if (legacy >= 0.2) return 'warn_previous_semester';
  return 'ok';
}

function buildHumanAiExplanation(proposal, matchedLegacy, matchedSameSemester) {
  const samePct = Math.round(Number(proposal?.aiSameSemesterMaxScore || 0) * 100);
  const legPct = Math.round(Number(proposal?.aiPreviousSemesterMaxScore || 0) * 100);
  const verdict = deriveSimilarityVerdict(proposal);
  const lines = [];

  if (verdict === 'reject_same_semester') {
    lines.push(
      `This proposal is highly similar to another submission in the current semester (${samePct}% overlap). Students should revise the idea, description, and features before resubmitting.`,
    );
    if (matchedSameSemester?.title) {
      lines.push(
        `Closest same-semester match: "${matchedSameSemester.title}"${
          matchedSameSemester.submittedBy?.name ? ` (${matchedSameSemester.submittedBy.name})` : ''
        }.`,
      );
      if (matchedSameSemester.description) {
        lines.push(`Matched overview: ${String(matchedSameSemester.description).trim()}`);
      }
    }
  } else if (verdict === 'warn_previous_semester') {
    lines.push(
      `This proposal resembles an approved project from a previous semester (${legPct}% semantic similarity). Review whether the team has added enough new scope.`,
    );
    if (matchedLegacy?.title) {
      lines.push(`Matched legacy project: "${matchedLegacy.title}".`);
    }
    if (matchedLegacy?.proposalDescription) {
      lines.push(`Legacy overview: ${String(matchedLegacy.proposalDescription).trim()}`);
    }
    if (proposal?.aiRecommendationText) {
      lines.push(proposal.aiRecommendationText);
    }
  } else {
    lines.push('No strong similarity was detected against same-semester peers or legacy projects.');
    if (samePct > 0 || legPct > 0) {
      lines.push(`Advisory scores — same semester: ${samePct}%, legacy / past term: ${legPct}%.`);
    }
  }

  return lines.join('\n\n');
}

function buildGroupSimilarityPayload(proposal, matchedLegacy, matchedSameSemester) {
  const sameSemester = Number(proposal?.aiSameSemesterMaxScore || 0);
  const previousSemester = Number(proposal?.aiPreviousSemesterMaxScore || 0);
  const overall = Math.round(Math.max(sameSemester, previousSemester) * 100);
  const verdict = deriveSimilarityVerdict(proposal);
  return {
    overallPercent: overall,
    level: overall >= 58 ? 'High' : overall >= 20 ? 'Medium' : 'Low',
    sameSemesterPercent: Math.round(sameSemester * 100),
    previousSemesterPercent: Math.round(previousSemester * 100),
    verdict,
    aiSummary: proposal?.aiSummary || '',
    humanExplanation: buildHumanAiExplanation(proposal, matchedLegacy, matchedSameSemester),
    recommendationText: proposal?.aiRecommendationText || '',
    suggestedFeatures: proposal?.aiSuggestedFeatures || [],
    matchedLegacy: matchedLegacy
      ? {
          title: matchedLegacy.title || '',
          description: matchedLegacy.proposalDescription || '',
          features: matchedLegacy.features || [],
          ownerLabel: matchedLegacy.ownerLabel || '',
        }
      : null,
    matchedSameSemester: matchedSameSemester
      ? {
          title: matchedSameSemester.title || '',
          description: matchedSameSemester.description || '',
          features: matchedSameSemester.features || [],
          studentName: matchedSameSemester.submittedBy?.name || '',
        }
      : null,
    matchedLegacyTitle: matchedLegacy?.title || '',
    proposalStatus: proposal?.status || '',
  };
}

export async function getGroupDetailsForTeacher(teacherId, groupId) {
  const tid = new mongoose.Types.ObjectId(teacherId);
  const group = await Group.findById(groupId)
    .populate({
      path: 'assignment',
      populate: { path: 'class', select: 'code name' },
    })
    .populate('leader', 'name photo email')
    .populate('members.user', 'name photo email');
  if (!group) return null;

  const memberUserIds = [
    String(group.leader?._id || group.leader),
    ...(group.members || []).map((m) => String(m.user?._id || m.user)),
  ].filter(Boolean);
  const profiles = memberUserIds.length
    ? await StudentProfile.find({ user: { $in: memberUserIds } }).select('user studentId').lean()
    : [];
  const studentIdByUser = new Map(profiles.map((p) => [String(p.user), p.studentId || '']));
  const members = mapGroupMembersForTeacherCard(group, studentIdByUser);

  if (group.assignment) {
    if (!group.assignment?.teacher?.equals?.(teacherId) && String(group.assignment?.teacher) !== String(teacherId)) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }

    const proposal = await Proposal.findOne({ assignment: group.assignment._id, group: group._id }).lean();
    const submission = proposal?._id
      ? await ProjectSubmission.findOne({ proposal: proposal._id }).sort({ createdAt: -1 }).lean()
      : null;
    const matchedLegacy = proposal?.aiMatchedLegacyId
      ? await LegacyProject.findById(proposal.aiMatchedLegacyId)
          .select('title proposalDescription features ownerLabel')
          .lean()
      : null;
    const matchedSameSemester = proposal?.aiMatchedProposalId
      ? await Proposal.findById(proposal.aiMatchedProposalId)
          .select('title description features status submittedBy')
          .populate('submittedBy', 'name')
          .lean()
      : null;
    const similarityPayload = buildGroupSimilarityPayload(proposal, matchedLegacy, matchedSameSemester);
    const projectClient = toProjectSubmissionClient(submission);
    const proposalText = buildProposalPlainText(proposal);
    const assignmentDoc = group.assignment?.toObject ? group.assignment.toObject() : group.assignment;

    const screenshotUrl = submission?.screenshotRelativePath
      ? `/uploads/${String(submission.screenshotRelativePath).replace(/^\/+/, '')}`
      : '';

    return {
      _id: group._id,
      title: proposal?.title || assignmentDoc?.title || group.name || 'Project',
      assignmentNumber: String(group._id).slice(-4).toUpperCase(),
      type: assignmentDoc?.submissionMode === 'single' ? 'individual' : 'group',
      classCode: assignmentDoc?.class?.code || assignmentDoc?.class?.name || '',
      assignmentId: String(assignmentDoc?._id || group.assignment._id || ''),
      proposalId: proposal?._id ? String(proposal._id) : '',
      members,
      similarity: similarityPayload.overallPercent,
      similarityLevel: similarityPayload.level,
      similarityDetails: similarityPayload,
      status: submission ? 'SUBMITTED' : (proposal?.status || 'DRAFT').toUpperCase(),
      proposalStatus: proposal?.status || 'draft',
      originalFileName: submission?.originalFilename || '',
      documentUrl: submission?.storedRelativePath ? `/uploads/${submission.storedRelativePath}` : '',
      project: projectClient,
      proposal: proposal
        ? {
            _id: String(proposal._id),
            title: proposal.title || '',
            description: proposal.description || '',
            features: proposal.features || [],
            status: proposal.status || 'draft',
            submittedAt: proposal.submittedAt || null,
            requirementCheckPassed: proposal.requirementCheckPassed !== false,
            requirementCheckSummary: proposal.requirementCheckSummary || '',
            requirementMissingKeywords: proposal.requirementMissingKeywords || [],
            aiSummary: proposal.aiSummary || '',
            teacherComment: proposal.teacherComment || '',
            teacherProposalScore: proposal.teacherProposalScore ?? null,
            teacherProposalScoreMax: proposal.teacherProposalScoreMax ?? 100,
            plainText: proposalText,
          }
        : null,
      documentation: {
        hasProposal: Boolean(proposal),
        hasProjectZip: Boolean(projectClient?.downloadPath),
        proposalTitle: proposal?.title || '',
        proposalPlainText: proposalText,
        projectFileName: projectClient?.originalFilename || submission?.originalFilename || '',
        projectDownloadPath: projectClient?.downloadPath || '',
        screenshotUrl,
      },
      reviewChecklist: buildGroupReviewChecklist(proposal, submission),
      reviewerFeedback: submission?.teacherComment || proposal?.teacherComment || '',
      isClassTeamTemplate: false,
    };
  }

  if (group.hostClass) {
    const hcId = group.hostClass;
    const allowed = await Class.exists({ _id: hcId, 'teacherAssignments.teacher': tid });
    if (!allowed) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
    const hc = await Class.findById(hcId).select('code name').lean();

    return {
      _id: group._id,
      title: group.name || 'Class team',
      assignmentNumber: String(group._id).slice(-4).toUpperCase(),
      type: 'group',
      classCode: hc?.code || hc?.name || '',
      members,
      similarity: 0,
      similarityLevel: 'Low',
      similarityDetails: buildGroupSimilarityPayload(null, null, null),
      status: 'CLASS_TEAM',
      proposalStatus: '',
      assignmentId: '',
      proposalId: '',
      originalFileName: '',
      documentUrl: '',
      project: null,
      proposal: null,
      documentation: {
        hasProposal: false,
        hasProjectZip: false,
        proposalTitle: '',
        proposalPlainText: '',
        projectFileName: '',
        projectDownloadPath: '',
        screenshotUrl: '',
      },
      reviewChecklist: [],
      reviewerFeedback: '',
      isClassTeamTemplate: true,
    };
  }

  return null;
}
