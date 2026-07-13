import mongoose from 'mongoose';
import { Assignment } from '../models/Assignment.js';
import { Class } from '../models/Class.js';
import { Semester } from '../models/Semester.js';
import { assertActiveCollaboration } from './teacherCollaboration.service.js';
import {
  assertClassSemesterAlignment,
  getAssignmentForTeacher,
  parseObjectIdList,
  teacherCanUseSubject,
} from './assignmentTeacher.service.js';

function parseList(value) {
  if (Array.isArray(value)) return value.map((x) => String(x || '').trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((x) => x.trim()).filter(Boolean);
  return [];
}

function parseTechBlock(raw = {}) {
  let source = raw;
  if (typeof raw === 'string') {
    try {
      source = JSON.parse(raw);
    } catch {
      source = { requirementText: raw };
    }
  }
  return {
    requirementText: String(source?.requirementText || '').trim(),
    description: String(source?.description || '').trim(),
    requiredKeywords: parseList(source?.requiredKeywords || source?.requiredKeywordsText),
    allowedTechnologies: parseList(source?.allowedTechnologies || source?.allowedTechnologiesText),
    requirementFile: String(source?.requirementFile || '').trim(),
    originalFileName: String(source?.originalFileName || '').trim(),
  };
}

export function isTechSectionComplete(block) {
  const parsed = parseTechBlock(block);
  return Boolean(parsed.requirementFile);
}

function blockSummaryText(block, label) {
  if (block.requirementText) return block.requirementText;
  if (block.requirementFile) {
    const name = block.originalFileName || 'uploaded file';
    return `${label} requirements are provided in file: ${name}`;
  }
  return '';
}

function mergeRequirementLists(frontendBlock, backendBlock) {
  return {
    requirementText: [blockSummaryText(frontendBlock, 'Frontend'), blockSummaryText(backendBlock, 'Backend')]
      .filter(Boolean)
      .join('\n\n'),
    requiredKeywords: [...new Set([...frontendBlock.requiredKeywords, ...backendBlock.requiredKeywords])],
    allowedTechnologies: [...new Set([...frontendBlock.allowedTechnologies, ...backendBlock.allowedTechnologies])],
  };
}

/**
 * Create a single dual-teacher assignment document with separate FE/BE requirement blocks.
 * Primary teacher must have an accepted collaboration with coTeacherId.
 */
export async function createCollaborativeAssignment(primaryTeacherId, payload) {
  const {
    coTeacherId,
    classId,
    classIds,
    subjectId,
    frontendSubjectId,
    backendSubjectId,
    semesterId,
    academicYearId,
    title,
    description,
    submissionMode,
    groupModeType,
    maxGroupSize,
    proposalDeadline,
    projectDeadline,
    frontendTechRequirements,
    backendTechRequirements,
    frontendTeacherId,
    backendTeacherId,
  } = payload;

  if (!coTeacherId) {
    const err = new Error('coTeacherId is required for collaborative assignments');
    err.status = 400;
    throw err;
  }
  if (!title?.trim()) {
    const err = new Error('title is required');
    err.status = 400;
    throw err;
  }
  const feSubjectId = frontendSubjectId || subjectId;
  const beSubjectId = backendSubjectId || subjectId;
  if (!feSubjectId || !beSubjectId) {
    const err = new Error('frontendSubjectId and backendSubjectId are required');
    err.status = 400;
    throw err;
  }

  await assertActiveCollaboration(primaryTeacherId, coTeacherId);

  const frontendBlock = parseTechBlock(frontendTechRequirements);
  const backendBlock = parseTechBlock(backendTechRequirements);
  if (!isTechSectionComplete(frontendBlock)) {
    const err = new Error('Frontend teacher must upload a requirements file');
    err.status = 400;
    throw err;
  }
  if (!isTechSectionComplete(backendBlock)) {
    const err = new Error('Backend teacher must upload a requirements file');
    err.status = 400;
    throw err;
  }

  const selectedClassIds = [...new Set(parseObjectIdList(classIds).concat(classId ? [String(classId)] : []))];
  if (!selectedClassIds.length) {
    const err = new Error('At least one class is required');
    err.status = 400;
    throw err;
  }

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

  const feTeacherId = frontendTeacherId || primaryTeacherId;
  const beTeacherId = backendTeacherId || coTeacherId;

  for (const classDoc of classDocs) {
    const feTa = classDoc.teacherAssignments?.find((x) => new mongoose.Types.ObjectId(feTeacherId).equals(x.teacher));
    const beTa = classDoc.teacherAssignments?.find((x) => new mongoose.Types.ObjectId(beTeacherId).equals(x.teacher));
    if (!feTa) {
      const err = new Error(`Frontend teacher is not assigned to class ${classDoc.code || classDoc.name || ''}`.trim());
      err.status = 403;
      throw err;
    }
    if (!beTa) {
      const err = new Error(`Backend teacher is not assigned to class ${classDoc.code || classDoc.name || ''}`.trim());
      err.status = 403;
      throw err;
    }
    if (!teacherCanUseSubject(classDoc, feTa, feSubjectId)) {
      const err = new Error(`Frontend subject is not linked to class ${classDoc.code || classDoc.name || ''}`.trim());
      err.status = 403;
      throw err;
    }
    if (!teacherCanUseSubject(classDoc, beTa, beSubjectId)) {
      const err = new Error(`Backend subject is not linked to class ${classDoc.code || classDoc.name || ''}`.trim());
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
  if (!semesterResolved || !academicYearResolved) {
    const err = new Error('Semester and academic year are required; configure class term in admin first');
    err.status = 400;
    throw err;
  }

  const mergedRequirements = mergeRequirementLists(frontendBlock, backendBlock);

  const doc = new Assignment({
    teacher: primaryTeacherId,
    coTeacherId,
    frontendTeacherId: feTeacherId,
    backendTeacherId: beTeacherId,
    isCollaborative: true,
    frontendTechRequirements: frontendBlock,
    backendTechRequirements: backendBlock,
    class: primaryClassDoc._id,
    classes: classDocs.map((c) => c._id),
    subject: beSubjectId,
    frontendSubject: feSubjectId,
    backendSubject: beSubjectId,
    semester: semesterResolved,
    academicYear: academicYearResolved,
    title: title.trim(),
    description: String(description || '').trim(),
    requirementText: mergedRequirements.requirementText,
    requiredKeywords: mergedRequirements.requiredKeywords,
    allowedTechnologies: mergedRequirements.allowedTechnologies,
    assignmentType: 'final',
    classAssignmentMode: classDocs.length > 1 ? 'multiple' : 'single',
    submissionMode: submissionMode || 'single',
    groupModeType: groupModeType || 'teacher_manual',
    maxGroupSize: maxGroupSize || 4,
    proposalPhaseOpen: true,
    projectPhaseOpen: false,
    proposalDeadline: proposalDeadline ? new Date(proposalDeadline) : null,
    projectDeadline: projectDeadline ? new Date(projectDeadline) : null,
  });

  await doc.save();
  return getAssignmentForTeacher(primaryTeacherId, doc._id);
}
