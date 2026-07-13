/**
 * One-time migration for teacher collaboration subject fields.
 *
 * Backfills:
 * - TeacherCollaboration.partnerSubject on accepted rows missing it
 * - CollaborativeAssignmentDraft.frontendSubject / backendSubject / class
 * - Assignment.frontendSubject / backendSubject on collaborative assignments
 *
 * Usage:
 *   cd backend-node && npm run migrate:collaboration-subjects
 *   cd backend-node && npm run migrate:collaboration-subjects -- --dry-run
 *   docker compose exec node-backend node scripts/migrate-collaboration-subjects.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { getMongoUri } from '../src/config/env.js';
import { TeacherCollaboration } from '../src/models/TeacherCollaboration.js';
import { CollaborativeAssignmentDraft } from '../src/models/CollaborativeAssignmentDraft.js';
import { Assignment } from '../src/models/Assignment.js';
import { Class } from '../src/models/Class.js';
import { Subject } from '../src/models/Subject.js';
import {
  findSubjectsForRole,
  oppositeCollaborationSide,
  resolveSubjectCollaborationSide,
} from '../src/services/subjectCollaboration.service.js';

const dryRun = process.argv.includes('--dry-run');

function idOf(value) {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

function partnerTeacherId(row) {
  const requesterId = idOf(row.initiatedBy);
  const primaryId = idOf(row.primaryTeacher);
  const coId = idOf(row.coTeacher);
  return primaryId === requesterId ? coId : primaryId;
}

async function loadTeacherSubjectsForClass(classId, teacherId) {
  const cls = await Class.findById(classId)
    .populate('teacherAssignments.subjects', 'code name description collaborationSide')
    .populate('subjects', 'code name description collaborationSide')
    .lean();
  if (!cls) return { classDoc: null, subjects: [] };

  const ta = (cls.teacherAssignments || []).find((row) => idOf(row.teacher) === idOf(teacherId));
  if (!ta) return { classDoc: cls, subjects: [] };

  const classSubjects = (cls.subjects || []).filter(Boolean);
  const teacherSubjects = (ta.subjects || []).filter(Boolean);
  const subjects = teacherSubjects.length ? teacherSubjects : classSubjects;
  return { classDoc: cls, subjects };
}

function pickPartnerSubject({ candidates, requesterSubjectId, draftSubjectId }) {
  const unique = [...new Map(candidates.map((s) => [idOf(s), s])).values()];
  if (!unique.length) return null;

  if (draftSubjectId) {
    const fromDraft = unique.find((s) => idOf(s) === idOf(draftSubjectId));
    if (fromDraft) return fromDraft;
  }

  const withoutRequester = unique.filter((s) => idOf(s) !== idOf(requesterSubjectId));
  if (withoutRequester.length === 1) return withoutRequester[0];
  if (unique.length === 1) return unique[0];

  return withoutRequester[0] || unique[0] || null;
}

function subjectsFromCollaboration(collab) {
  const requesterRole = collab.requesterRole || '';
  const requesterSubjectId = idOf(collab.subject);
  const partnerSubjectId = idOf(collab.partnerSubject);
  const frontendSubjectId =
    requesterRole === 'frontend' ? requesterSubjectId : partnerSubjectId;
  const backendSubjectId =
    requesterRole === 'backend' ? requesterSubjectId : partnerSubjectId;
  return { frontendSubjectId, backendSubjectId };
}

async function findDraftForPair(teacherAId, teacherBId) {
  const a = new mongoose.Types.ObjectId(teacherAId);
  const b = new mongoose.Types.ObjectId(teacherBId);
  return CollaborativeAssignmentDraft.findOne({
    $or: [
      { initiatedBy: a, coTeacherId: b },
      { initiatedBy: b, coTeacherId: a },
    ],
  })
    .sort({ updatedAt: -1 })
    .lean();
}

async function inferCollaborationMetadataFromDraft(row) {
  const requesterId = idOf(row.initiatedBy);
  const partnerId = partnerTeacherId(row);
  const draft = await findDraftForPair(requesterId, partnerId);
  if (!draft) return null;

  const classId = draft.class || draft.classes?.[0];
  const draftSubjectId = draft.subject || draft.backendSubject || draft.frontendSubject;
  if (!classId || !draftSubjectId) return null;

  let requesterRole = row.requesterRole || '';
  if (!requesterRole && draft.frontendTeacherId && draft.backendTeacherId) {
    if (idOf(draft.frontendTeacherId) === requesterId) requesterRole = 'frontend';
    if (idOf(draft.backendTeacherId) === requesterId) requesterRole = 'backend';
  }
  if (!requesterRole) return null;

  const partnerRole = oppositeCollaborationSide(requesterRole);
  const { subjects: requesterSubjects } = await loadTeacherSubjectsForClass(classId, requesterId);
  const { subjects: partnerSubjects } = await loadTeacherSubjectsForClass(classId, partnerId);

  const requesterCandidates = findSubjectsForRole(requesterSubjects, requesterRole);
  const partnerCandidates = findSubjectsForRole(partnerSubjects, partnerRole);

  const requesterSubject =
    requesterCandidates.find((s) => idOf(s) === idOf(draft.frontendSubject)) ||
    requesterCandidates.find((s) => idOf(s) === idOf(draft.backendSubject)) ||
    requesterCandidates.find((s) => idOf(s) === idOf(draftSubjectId)) ||
    requesterCandidates[0] ||
    null;

  const partnerSubject =
    partnerCandidates.find((s) => idOf(s) === idOf(draft.frontendSubject)) ||
    partnerCandidates.find((s) => idOf(s) === idOf(draft.backendSubject)) ||
    partnerCandidates.find((s) => idOf(s) === idOf(draftSubjectId)) ||
    pickPartnerSubject({
      candidates: partnerCandidates,
      requesterSubjectId: requesterSubject,
      draftSubjectId,
    });

  if (!requesterSubject || !partnerSubject) return null;

  return {
    classId,
    requesterRole,
    requesterSubjectId: idOf(requesterSubject),
    partnerSubjectId: idOf(partnerSubject),
  };
}

async function migrateCollaborations() {
  const rows = await TeacherCollaboration.find({ status: 'accepted' })
    .populate('subject', 'code name collaborationSide')
    .populate('partnerSubject', 'code name collaborationSide')
    .lean();

  let updated = 0;
  let skipped = 0;
  let metadataFixed = 0;

  for (const row of rows) {
    const label = `collaboration ${row._id}`;
    const requesterId = idOf(row.initiatedBy);
    const partnerId = partnerTeacherId(row);
    let classId = row.class;
    let requesterRole = row.requesterRole || '';
    let requesterSubjectId = idOf(row.subject);
    let partnerSubjectId = idOf(row.partnerSubject);

    const needsMetadata = !classId || !requesterSubjectId || !requesterRole;
    const needsPartnerSubject = !partnerSubjectId;

    if (!needsMetadata && !needsPartnerSubject) continue;

    if (needsMetadata) {
      const inferred = await inferCollaborationMetadataFromDraft(row);
      if (!inferred) {
        console.warn(`[skip] ${label}: missing class/subject/role and could not infer from draft`);
        skipped += 1;
        continue;
      }
      classId = inferred.classId;
      requesterRole = inferred.requesterRole;
      requesterSubjectId = inferred.requesterSubjectId;
      if (!partnerSubjectId) partnerSubjectId = inferred.partnerSubjectId;
      console.log(
        `[collab-meta] ${label}: class=${classId} role=${requesterRole} requesterSubject=${requesterSubjectId}`
      );
      if (!dryRun) {
        await TeacherCollaboration.updateOne(
          { _id: row._id },
          {
            $set: {
              class: new mongoose.Types.ObjectId(classId),
              requesterRole,
              subject: new mongoose.Types.ObjectId(requesterSubjectId),
              ...(partnerSubjectId
                ? { partnerSubject: new mongoose.Types.ObjectId(partnerSubjectId) }
                : {}),
            },
          }
        );
      }
      metadataFixed += 1;
      if (partnerSubjectId) {
        updated += 1;
        continue;
      }
    }

    if (!needsPartnerSubject) continue;

    const partnerRole = oppositeCollaborationSide(requesterRole);
    if (!classId || !requesterSubjectId || !partnerRole) {
      console.warn(`[skip] ${label}: missing class, subject, or requesterRole`);
      skipped += 1;
      continue;
    }

    const { subjects } = await loadTeacherSubjectsForClass(classId, partnerId);
    const candidates = findSubjectsForRole(subjects, partnerRole);
    const draft = await findDraftForPair(requesterId, partnerId);
    const draftSubjectId = draft?.subject || draft?.backendSubject || draft?.frontendSubject || null;
    const picked = pickPartnerSubject({
      candidates,
      requesterSubjectId,
      draftSubjectId,
    });

    if (!picked) {
      console.warn(
        `[skip] ${label}: could not infer partnerSubject for partner ${partnerId} (${partnerRole}) in class ${classId}`
      );
      skipped += 1;
      continue;
    }

    const pickedSide = resolveSubjectCollaborationSide(picked);
    if (pickedSide !== partnerRole) {
      console.warn(
        `[skip] ${label}: picked subject ${picked.code || picked._id} is ${pickedSide || 'unknown'}, expected ${partnerRole}`
      );
      skipped += 1;
      continue;
    }

    console.log(
      `[collab] ${label}: partnerSubject -> ${picked.code || picked.name || picked._id} (${partnerRole})`
    );

    if (!dryRun) {
      await TeacherCollaboration.updateOne({ _id: row._id }, { $set: { partnerSubject: picked._id } });
    }
    updated += 1;
  }

  return { scanned: rows.length, updated, skipped, metadataFixed };
}

async function migrateDrafts() {
  const rows = await CollaborativeAssignmentDraft.find({
    $or: [
      { frontendSubject: null },
      { frontendSubject: { $exists: false } },
      { backendSubject: null },
      { backendSubject: { $exists: false } },
    ],
  }).lean();

  let updated = 0;
  let skipped = 0;

  for (const draft of rows) {
    const label = `draft ${draft._id}`;
    const teacherA = idOf(draft.initiatedBy);
    const teacherB = idOf(draft.coTeacherId);
    const collab = await TeacherCollaboration.findOne({
      status: 'accepted',
      $or: [
        { primaryTeacher: teacherA, coTeacher: teacherB },
        { primaryTeacher: teacherB, coTeacher: teacherA },
      ],
    })
      .populate('subject', 'code name collaborationSide')
      .populate('partnerSubject', 'code name collaborationSide')
      .lean();

    if (!collab?.subject || !collab?.partnerSubject) {
      const teacherA = idOf(draft.initiatedBy);
      const teacherB = idOf(draft.coTeacherId);
      const requesterId = idOf(collab?.initiatedBy);
      const partnerId = collab ? partnerTeacherId(collab) : '';
      let requesterRole = collab?.requesterRole || '';
      if (!requesterRole && draft.frontendTeacherId && draft.backendTeacherId) {
        if (idOf(draft.frontendTeacherId) === teacherA) requesterRole = 'frontend';
        else if (idOf(draft.backendTeacherId) === teacherA) requesterRole = 'backend';
      }
      const classId = collab?.class || draft.class || draft.classes?.[0];
      if (classId && requesterRole) {
        const partnerRole = oppositeCollaborationSide(requesterRole);
        const { subjects: requesterSubjects } = await loadTeacherSubjectsForClass(classId, requesterId || teacherA);
        const { subjects: partnerSubjects } = await loadTeacherSubjectsForClass(classId, partnerId || teacherB);
        const requesterSubject =
          findSubjectsForRole(requesterSubjects, requesterRole).find((s) => idOf(s) === idOf(draft.frontendSubject)) ||
          findSubjectsForRole(requesterSubjects, requesterRole).find((s) => idOf(s) === idOf(draft.backendSubject)) ||
          findSubjectsForRole(requesterSubjects, requesterRole).find((s) => idOf(s) === idOf(draft.subject)) ||
          findSubjectsForRole(requesterSubjects, requesterRole)[0];
        const partnerSubject =
          findSubjectsForRole(partnerSubjects, partnerRole).find((s) => idOf(s) === idOf(draft.frontendSubject)) ||
          findSubjectsForRole(partnerSubjects, partnerRole).find((s) => idOf(s) === idOf(draft.backendSubject)) ||
          findSubjectsForRole(partnerSubjects, partnerRole).find((s) => idOf(s) === idOf(draft.subject)) ||
          findSubjectsForRole(partnerSubjects, partnerRole)[0];

        if (requesterSubject && partnerSubject) {
          const syntheticCollab = {
            requesterRole,
            subject: requesterSubject._id,
            partnerSubject: partnerSubject._id,
          };
          const { frontendSubjectId, backendSubjectId } = subjectsFromCollaboration(syntheticCollab);
          const classDoc = await Class.findById(classId).lean();
          const patch = {
            frontendSubject: new mongoose.Types.ObjectId(frontendSubjectId),
            backendSubject: new mongoose.Types.ObjectId(backendSubjectId),
            subject: new mongoose.Types.ObjectId(backendSubjectId),
            class: new mongoose.Types.ObjectId(classId),
            classes: [new mongoose.Types.ObjectId(classId)],
          };
          if (!draft.semester && classDoc?.semester) patch.semester = classDoc.semester;
          if (!draft.academicYear && classDoc?.academicYear) patch.academicYear = classDoc.academicYear;
          console.log(`[draft-infer] ${label}: FE=${frontendSubjectId} BE=${backendSubjectId}`);
          if (!dryRun) {
            await CollaborativeAssignmentDraft.updateOne({ _id: draft._id }, { $set: patch });
          }
          updated += 1;
          continue;
        }
      }

      console.warn(`[skip] ${label}: accepted collaboration missing both subjects`);
      skipped += 1;
      continue;
    }

    const { frontendSubjectId, backendSubjectId } = subjectsFromCollaboration(collab);
    const classId = collab.class || draft.class;
    const classDoc = classId ? await Class.findById(classId).lean() : null;
    const patch = {
      frontendSubject: new mongoose.Types.ObjectId(frontendSubjectId),
      backendSubject: new mongoose.Types.ObjectId(backendSubjectId),
      subject: new mongoose.Types.ObjectId(backendSubjectId),
    };
    if (classId && !draft.class) {
      patch.class = new mongoose.Types.ObjectId(classId);
      patch.classes = [new mongoose.Types.ObjectId(classId)];
    }
    if (!draft.semester && classDoc?.semester) patch.semester = classDoc.semester;
    if (!draft.academicYear && classDoc?.academicYear) patch.academicYear = classDoc.academicYear;

    console.log(`[draft] ${label}: FE=${frontendSubjectId} BE=${backendSubjectId}`);

    if (!dryRun) {
      await CollaborativeAssignmentDraft.updateOne({ _id: draft._id }, { $set: patch });
    }
    updated += 1;
  }

  return { scanned: rows.length, updated, skipped };
}

async function migrateAssignments() {
  const rows = await Assignment.find({
    isCollaborative: true,
    $or: [
      { frontendSubject: null },
      { frontendSubject: { $exists: false } },
      { backendSubject: null },
      { backendSubject: { $exists: false } },
    ],
  }).lean();

  let updated = 0;
  let skipped = 0;

  for (const assignment of rows) {
    const label = `assignment ${assignment._id}`;
    const teacherA = idOf(assignment.teacher);
    const teacherB = idOf(assignment.coTeacherId);
    const collab = await TeacherCollaboration.findOne({
      status: 'accepted',
      $or: [
        { primaryTeacher: teacherA, coTeacher: teacherB },
        { primaryTeacher: teacherB, coTeacher: teacherA },
      ],
    }).lean();

    let frontendSubjectId = '';
    let backendSubjectId = '';

    if (collab?.subject && collab?.partnerSubject) {
      ({ frontendSubjectId, backendSubjectId } = subjectsFromCollaboration(collab));
    } else {
      const draft = await findDraftForPair(teacherA, teacherB);
      if (draft?.frontendSubject && draft?.backendSubject) {
        frontendSubjectId = idOf(draft.frontendSubject);
        backendSubjectId = idOf(draft.backendSubject);
      } else if (assignment.subject) {
        const side = resolveSubjectCollaborationSide({ _id: assignment.subject });
        if (side === 'frontend') {
          frontendSubjectId = idOf(assignment.subject);
        } else if (side === 'backend') {
          backendSubjectId = idOf(assignment.subject);
        }
      }
    }

    if (!frontendSubjectId || !backendSubjectId) {
      console.warn(`[skip] ${label}: could not infer frontend/backend subjects`);
      skipped += 1;
      continue;
    }

    console.log(`[assignment] ${label}: FE=${frontendSubjectId} BE=${backendSubjectId}`);

    if (!dryRun) {
      await Assignment.updateOne(
        { _id: assignment._id },
        {
          $set: {
            frontendSubject: new mongoose.Types.ObjectId(frontendSubjectId),
            backendSubject: new mongoose.Types.ObjectId(backendSubjectId),
            subject: new mongoose.Types.ObjectId(backendSubjectId),
          },
        }
      );
    }
    updated += 1;
  }

  return { scanned: rows.length, updated, skipped };
}

async function run() {
  const uri = getMongoUri();
  await mongoose.connect(uri);
  console.log(`Connected: ${uri}`);
  console.log(dryRun ? 'DRY RUN — no documents will be modified' : 'LIVE RUN — writing changes');

  const collabStats = await migrateCollaborations();
  const draftStats = await migrateDrafts();
  const assignmentStats = await migrateAssignments();

  console.log('\nSummary');
  console.log('Collaborations:', collabStats);
  console.log('Drafts:', draftStats);
  console.log('Assignments:', assignmentStats);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
