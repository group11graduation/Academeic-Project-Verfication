import mongoose from 'mongoose';
import xlsx from 'xlsx';
import { Class } from '../models/Class.js';
import { Assignment } from '../models/Assignment.js';
import { Group } from '../models/Group.js';
import { Proposal } from '../models/Proposal.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { User } from '../models/User.js';
import { Enrollment } from '../models/Enrollment.js';
import { ProjectSubmission } from '../models/ProjectSubmission.js';

function assignmentClassCodesFromDoc(assignment) {
  const rawClasses = Array.isArray(assignment?.classes) && assignment.classes.length
    ? assignment.classes
    : assignment?.class
      ? [assignment.class]
      : [];
  const codes = new Set();
  for (const c of rawClasses) {
    if (c?.code) codes.add(String(c.code).trim().toUpperCase());
  }
  return [...codes];
}

function assignmentIncludesClassCode(assignment, classCode) {
  const want = String(classCode || '').trim().toUpperCase();
  return assignmentClassCodesFromDoc(assignment).includes(want);
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function mapGroupMembersForTeacherCard(group, studentIdByUser) {
  const leaderId = String(group.leader?._id || group.leader || '');
  const rawMembers = [
    group.leader
      ? { ...(group.leader.toObject ? group.leader.toObject() : group.leader), user: group.leader }
      : null,
    ...(group.members || []).map((m) => {
      const user = m.user?.toObject ? m.user.toObject() : m.user;
      return user ? { ...user, user } : { ...(m || {}), user: m?.user };
    }),
  ].filter(Boolean);

  const seen = new Set();
  const members = [];
  for (const member of rawMembers) {
    const id = String(member._id || member.user?._id || member.user || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    members.push({
      _id: member._id || member.user?._id || member.user,
      name: member.name || 'Student',
      photo: member.photo || '',
      studentId: studentIdByUser.get(id) || '',
      isLeader: Boolean(leaderId && id === leaderId),
    });
  }
  return members;
}

function memberUserIdsFromGroupLean(group) {
  const ids = [
    String(group.leader?._id || group.leader || ''),
    ...(group.members || []).map((m) => String(m.user?._id || m.user || '')),
  ].filter(Boolean);
  return [...new Set(ids)];
}

function memberSetKeyFromGroupLean(group) {
  return memberUserIdsFromGroupLean(group).sort().join('|');
}

export { memberSetKeyFromGroupLean, classTemplateDuplicatesAssignmentGroup };

function classTemplateDuplicatesAssignmentGroup(templateGroup, assignmentGroups) {
  const templateKey = memberSetKeyFromGroupLean(templateGroup);
  if (!templateKey) return false;
  return (assignmentGroups || []).some((g) => memberSetKeyFromGroupLean(g) === templateKey);
}

/** Students already placed on a class template or any group-mode assignment for this class. */
async function collectAlreadyGroupedUserIdsForClass(cls, teacherId) {
  const grouped = new Set();
  const cid = cls._id;
  const tid = new mongoose.Types.ObjectId(teacherId);

  const templateGroups = await Group.find({ assignment: null, hostClass: cid }).select('leader members').lean();
  for (const g of templateGroups) {
    memberUserIdsFromGroupLean(g).forEach((id) => grouped.add(id));
  }

  const assignments = await Assignment.find({
    teacher: tid,
    isActive: true,
    submissionMode: 'group',
    $or: [{ class: cid }, { classes: cid }],
  })
    .select('_id')
    .lean();

  const assignmentIds = assignments.map((a) => a._id);
  if (assignmentIds.length) {
    const assignmentGroups = await Group.find({ assignment: { $in: assignmentIds } })
      .select('leader members')
      .lean();
    for (const g of assignmentGroups) {
      memberUserIdsFromGroupLean(g).forEach((id) => grouped.add(id));
    }
  }

  return grouped;
}

/** Copy new class templates onto group-mode assignments without duplicating member sets. */
async function syncNewClassTemplatesToAssignments(teacherId, hostClassId) {
  const tid = new mongoose.Types.ObjectId(teacherId);
  const cid = hostClassId;

  const [assignments, templates] = await Promise.all([
    Assignment.find({
      teacher: tid,
      isActive: true,
      submissionMode: 'group',
      $or: [{ class: cid }, { classes: cid }],
    })
      .select('_id')
      .lean(),
    Group.find({ assignment: null, hostClass: cid }).lean(),
  ]);

  if (!assignments.length || !templates.length) return { synced: 0 };

  let synced = 0;
  for (const a of assignments) {
    const existingGroups = await Group.find({ assignment: a._id }).select('leader members').lean();
    const existingMemberKeys = new Set(existingGroups.map((g) => memberSetKeyFromGroupLean(g)));
    const assignedUserIds = new Set();
    for (const g of existingGroups) {
      memberUserIdsFromGroupLean(g).forEach((id) => assignedUserIds.add(id));
    }

    for (const t of templates) {
      const templateKey = memberSetKeyFromGroupLean(t);
      if (!templateKey || existingMemberKeys.has(templateKey)) continue;

      const templateUserIds = memberUserIdsFromGroupLean(t);
      const overlapsExisting = templateUserIds.some((id) => assignedUserIds.has(id));
      if (overlapsExisting) continue;

      await Group.create({
        assignment: a._id,
        hostClass: null,
        name: t.name || 'Group',
        leader: t.leader,
        members: t.members || [],
      });
      templateUserIds.forEach((id) => assignedUserIds.add(id));
      existingMemberKeys.add(templateKey);
      synced += 1;
    }
  }

  return { synced };
}

function csvEscapeCell(s) {
  const t = String(s ?? '');
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQ = !inQ;
      }
    } else if (!inQ && c === ',') {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

function normalizeImportCell(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (Math.abs(v - Math.round(v)) < 1e-9 && Math.abs(v) < 1e15) return String(Math.round(v));
    return String(v).trim();
  }
  return String(v).trim();
}

/** Lowercase + strip BOM; remove spaces/underscores/hyphens so "Group Name", "GROUPNAME", "group_name" match */
function normalizeImportHeaderKey(h) {
  let s = normalizeImportCell(h).replace(/^\ufeff/, '');
  s = s.toLowerCase().replace(/[\s_\-]+/g, '');
  return s;
}

function csvTextToMatrix(csvText) {
  return String(csvText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length)
    .map((line) => parseCsvLine(line));
}

function xlsxBufferToMatrix(buffer) {
  const wb = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const raw = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: false });
  return raw.map((row) => (Array.isArray(row) ? row : []).map(normalizeImportCell));
}

const GROUP_HEADER_ALIASES = new Set(['groupname', 'group', 'team', 'teamname']);
const STUDENT_HEADER_ALIASES = new Set(['studentid', 'id', 'student']);
const ROLE_HEADER_ALIASES = new Set(['role', 'type']);

const MAX_GROUP_IMPORT_HEADER_SCAN_ROWS = 40;

function tryResolveGroupImportColumnIndices(headerRow) {
  const header = headerRow.map((h) => normalizeImportHeaderKey(h));
  const idxGroup = header.findIndex((key) => GROUP_HEADER_ALIASES.has(key));
  const idxStudent = header.findIndex((key) => STUDENT_HEADER_ALIASES.has(key));
  const idxRole = header.findIndex((key) => ROLE_HEADER_ALIASES.has(key));
  if (idxGroup < 0 || idxStudent < 0) return null;
  return { idxGroup, idxStudent, idxRole };
}

function resolveGroupImportColumnIndices(headerRow) {
  const resolved = tryResolveGroupImportColumnIndices(headerRow);
  if (!resolved) {
    const err = new Error(
      'File must include a group column (e.g. group name, group, team) and a student column (e.g. student id, id). Spacing and letter case are ignored. If the sheet has a title above the table, the header row can be on a later row (first 40 rows are scanned).',
    );
    err.status = 400;
    throw err;
  }
  return resolved;
}

/** First row (within scan limit) that looks like a header row with both group and student columns */
function findGroupImportHeaderRow(matrix) {
  const limit = Math.min(matrix.length, MAX_GROUP_IMPORT_HEADER_SCAN_ROWS);
  for (let ri = 0; ri < limit; ri += 1) {
    const row = matrix[ri] || [];
    if (!row.some((c) => normalizeImportCell(c))) continue;
    const resolved = tryResolveGroupImportColumnIndices(row);
    if (resolved) return { headerRowIndex: ri, ...resolved };
  }
  resolveGroupImportColumnIndices([]);
}

function buildByGroupFromImportMatrix(matrix, roster) {
  if (!matrix || matrix.length < 2) {
    const err = new Error('File must include a header row and at least one data row');
    err.status = 400;
    throw err;
  }
  const { headerRowIndex, idxGroup, idxStudent, idxRole } = findGroupImportHeaderRow(matrix);
  const byGroup = new Map();
  const rejectedRows = [];
  const usedUserIds = new Set();

  for (let li = headerRowIndex + 1; li < matrix.length; li += 1) {
    const row = matrix[li] || [];
    const cells = row.map(normalizeImportCell);
    if (cells.every((c) => !c)) continue;
    const gname = String(cells[idxGroup] || '').trim();
    const sidRaw = String(cells[idxStudent] || '').trim();
    const role = idxRole >= 0 ? String(cells[idxRole] || '').trim().toLowerCase() : '';
    if (!gname || !sidRaw) continue;

    const sidKey = sidRaw.toUpperCase();
    const uid = roster.get(sidKey);
    if (!uid) {
      rejectedRows.push({ groupName: gname, studentId: sidRaw, reason: 'not_in_class_roster' });
      continue;
    }
    const uidStr = String(uid);
    if (usedUserIds.has(uidStr)) {
      rejectedRows.push({ groupName: gname, studentId: sidRaw, reason: 'duplicate_student_already_assigned' });
      continue;
    }

    if (!byGroup.has(gname)) byGroup.set(gname, []);
    byGroup.get(gname).push({ studentId: sidRaw, role, userId: uid });
    usedUserIds.add(uidStr);
  }

  return { byGroup, rejectedRows };
}

function splitProposedAndSkippedFromByGroup(byGroup) {
  const proposedGroups = [];
  const skippedGroups = [];
  for (const [gname, rows] of byGroup.entries()) {
    if (!rows.length) {
      skippedGroups.push({ groupName: gname, reason: 'no_valid_students' });
    } else {
      proposedGroups.push({
        groupName: gname,
        members: rows.map((r) => ({ studentId: r.studentId, role: r.role || '' })),
      });
    }
  }
  return { proposedGroups, skippedGroups };
}

/** Rebuild import plan from client payload; rejects unknown IDs and duplicates (same rules as file parse). */
function materializeClassTemplateProposals(proposedGroups, roster) {
  const byGroup = new Map();
  const rejectedRows = [];
  const usedUserIds = new Set();

  for (const g of proposedGroups || []) {
    const gname = String(g.groupName ?? g.name ?? '').trim();
    if (!gname) continue;
    const members = Array.isArray(g.members) ? g.members : [];
    for (const m of members) {
      const sidRaw = String(m.studentId ?? m.id ?? '').trim();
      const role = String(m.role || '').trim().toLowerCase();
      if (!sidRaw) continue;
      const sidKey = sidRaw.toUpperCase();
      const uid = roster.get(sidKey);
      if (!uid) {
        rejectedRows.push({ groupName: gname, studentId: sidRaw, reason: 'not_in_class_roster' });
        continue;
      }
      const uidStr = String(uid);
      if (usedUserIds.has(uidStr)) {
        rejectedRows.push({ groupName: gname, studentId: sidRaw, reason: 'duplicate_student_already_assigned' });
        continue;
      }
      if (!byGroup.has(gname)) byGroup.set(gname, []);
      byGroup.get(gname).push({ studentId: sidRaw, role, userId: uid });
      usedUserIds.add(uidStr);
    }
  }
  return { byGroup, rejectedRows };
}

async function loadRosterForClassTemplate(cls) {
  const rawCode = String(cls.code || '').trim();
  const codeUpper = rawCode.toUpperCase();
  const rosterCodes = [...new Set([codeUpper, rawCode].filter(Boolean))];
  const roster = await studentIdToUserIdMapForClassCodes(rosterCodes);
  // Enrollment-only students may not have a StudentProfile/studentId yet. Accept the
  // user ObjectId used by the editor so moving those students remains saveable.
  const { userIds } = await collectRosterUserIdsForClassTemplate(cls);
  for (const userId of userIds) {
    const id = String(userId);
    if (id) roster.set(id.toUpperCase(), new mongoose.Types.ObjectId(id));
  }
  return { roster, rosterCodes };
}

async function persistClassTemplateGroupsFromByGroup(cls, byGroup) {
  const removed = await deleteClassTemplateGroups(cls._id);
  const createdGroups = [];
  const skippedGroups = [];

  for (const [gname, rows] of byGroup.entries()) {
    if (!rows.length) {
      skippedGroups.push({ groupName: gname, reason: 'no_valid_students' });
      continue;
    }
    let leaderRow = rows.find((r) => r.role === 'leader');
    if (!leaderRow) leaderRow = rows[0];
    const leader = leaderRow.userId;
    const memberRows = rows.filter((r) => String(r.userId) !== String(leader));
    const members = memberRows.map((r) => ({ user: r.userId }));

    const g = await Group.create({
      assignment: null,
      hostClass: cls._id,
      name: gname,
      leader,
      members,
    });
    createdGroups.push({ _id: String(g._id), name: g.name, memberCount: 1 + members.length });
  }

  return {
    templateGroupsRemoved: removed.deletedCount,
    createdGroups,
    skippedGroups,
  };
}

function xlsxBufferFromMatrix(matrix) {
  const ws = xlsx.utils.aoa_to_sheet(matrix);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Teams');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

async function resolveClassForTeacher(teacherId, classRef) {
  const tid = new mongoose.Types.ObjectId(teacherId);
  const raw = String(classRef || '').trim();
  if (!raw) return null;
  const q = mongoose.Types.ObjectId.isValid(raw)
    ? { _id: raw, 'teacherAssignments.teacher': tid }
    : { code: raw.toUpperCase(), 'teacherAssignments.teacher': tid };
  return Class.findOne(q).lean();
}

/** Class codes as stored vs upper-case (StudentProfile.classCode may not be normalized). */
function classCodeQueryVariants(cls) {
  const rawCode = String(cls?.code || '').trim();
  const codeUpper = rawCode.toUpperCase();
  return [...new Set([codeUpper, rawCode].filter(Boolean))];
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Match StudentProfile.classCode to a class even when casing/spacing differs slightly. */
function buildClassCodeProfileFilter(cls) {
  const rawCode = String(cls?.code || '').trim();
  const codeUpper = rawCode.toUpperCase();
  if (!codeUpper) return null;
  const variants = classCodeQueryVariants(cls);
  return {
    $or: [
      { classCode: { $in: variants } },
      { classCode: { $regex: new RegExp(`^\\s*${escapeRegExp(codeUpper)}\\s*$`, 'i') } },
    ],
  };
}

/**
 * All students who should appear on this class roster for auto-grouping:
 * profiles whose classCode matches this class, plus users with an active Enrollment on this class.
 */
async function collectRosterUserIdsForClassTemplate(cls) {
  const profileFilter = buildClassCodeProfileFilter(cls);
  const profileRows = profileFilter
    ? await StudentProfile.find(profileFilter).select('user').lean()
    : [];
  const enrollmentRows = await Enrollment.find({ class: cls._id, status: 'active' }).select('student').lean();

  const idStrs = new Set();
  for (const p of profileRows) {
    const u = String(p.user || '').trim();
    if (u) idStrs.add(u);
  }
  for (const e of enrollmentRows) {
    const u = String(e.student || '').trim();
    if (u) idStrs.add(u);
  }

  const userIds = [...idStrs].map((id) => new mongoose.Types.ObjectId(id));
  return {
    userIds,
    profileMatchCount: profileRows.length,
    enrollmentMatchCount: enrollmentRows.length,
    uniqueStudentCount: userIds.length,
  };
}

export async function countClassRosterStudents(cls) {
  if (!cls?._id) return 0;
  const { uniqueStudentCount } = await collectRosterUserIdsForClassTemplate(cls);
  return uniqueStudentCount;
}

export async function listClassStudentsForTeacher(teacherId, classRef) {
  const cls = await resolveClassForTeacher(teacherId, classRef);
  if (!cls) {
    const err = new Error('Class not found');
    err.status = 404;
    throw err;
  }

  const { userIds } = await collectRosterUserIdsForClassTemplate(cls);
  if (!userIds.length) return [];

  const [users, profiles, templateGroups] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select('name email photo').lean(),
    StudentProfile.find({ user: { $in: userIds } }).select('user studentId classCode').lean(),
    Group.find({ assignment: null, hostClass: cls._id }).select('name leader members').lean(),
  ]);

  const profileByUser = new Map(profiles.map((p) => [String(p.user), p]));
  const userById = new Map(users.map((u) => [String(u._id), u]));
  const userToTemplateGroup = new Map();
  for (const g of templateGroups) {
    const memberIds = [
      String(g.leader || ''),
      ...(g.members || []).map((m) => String(m.user || '')),
    ].filter(Boolean);
    for (const uid of memberIds) {
      if (!userToTemplateGroup.has(uid)) userToTemplateGroup.set(uid, g.name || 'Group');
    }
  }

  return userIds.map((uid) => {
    const uidStr = String(uid);
    const u = userById.get(uidStr);
    const p = profileByUser.get(uidStr);
    const studentId = String(p?.studentId || '').trim();
    return {
      id: studentId || uidStr,
      studentId,
      name: u?.name || 'Student',
      email: u?.email || '',
      photo: u?.photo || '',
      userId: uidStr,
      group: userToTemplateGroup.get(uidStr) || 'UNASSIGNED',
      attendance: 0,
      avatarColor: 'bg-blue-500/10',
    };
  });
}

/**
 * Editable class-team snapshot for the teacher UI.
 * Includes every current roster student, existing class templates, and students that
 * are not yet assigned. Assignment-bound project groups are intentionally untouched.
 */
export async function getClassTemplateGroupsEditor(teacherId, classRef) {
  const cls = await resolveClassForTeacher(teacherId, classRef);
  if (!cls) {
    const err = new Error('Class not found');
    err.status = 404;
    throw err;
  }

  const [students, groups] = await Promise.all([
    listClassStudentsForTeacher(teacherId, classRef),
    Group.find({ assignment: null, hostClass: cls._id })
      .select('name leader members createdAt')
      .sort({ createdAt: 1, _id: 1 })
      .lean(),
  ]);

  const studentByUser = new Map(students.map((student) => [String(student.userId), student]));
  const assigned = new Set();
  const editableGroups = groups.map((group) => {
    const leaderId = String(group.leader || '');
    const userIds = [
      leaderId,
      ...(group.members || []).map((member) => String(member.user || '')),
    ].filter(Boolean);
    const members = [];
    const seen = new Set();
    for (const userId of userIds) {
      if (seen.has(userId)) continue;
      seen.add(userId);
      const student = studentByUser.get(userId);
      if (!student) continue;
      assigned.add(userId);
      members.push({
        userId,
        studentId: student.studentId || student.id,
        name: student.name,
        email: student.email,
        photo: student.photo,
        role: userId === leaderId ? 'leader' : 'member',
      });
    }
    return {
      _id: String(group._id),
      name: group.name || 'Group',
      members,
    };
  });

  return {
    class: {
      _id: String(cls._id),
      code: cls.code,
      title: cls.name || cls.code,
    },
    groups: editableGroups,
    students: students.map((student) => ({
      userId: student.userId,
      studentId: student.studentId || student.id,
      name: student.name,
      email: student.email,
      photo: student.photo,
      assigned: assigned.has(String(student.userId)),
    })),
    unassignedCount: students.filter((student) => !assigned.has(String(student.userId))).length,
  };
}

export async function getClassStudentDetailForTeacher(teacherId, classRef, studentUserId) {
  const cls = await resolveClassForTeacher(teacherId, classRef);
  if (!cls) {
    const err = new Error('Class not found');
    err.status = 404;
    throw err;
  }

  const uid = String(studentUserId || '').trim();
  if (!mongoose.Types.ObjectId.isValid(uid)) {
    const err = new Error('Invalid student');
    err.status = 400;
    throw err;
  }

  const roster = await listClassStudentsForTeacher(teacherId, classRef);
  const onRoster = roster.some((s) => String(s.userId || '') === uid);
  if (!onRoster) {
    const err = new Error('Student not found in this class');
    err.status = 404;
    throw err;
  }

  const [user, profile] = await Promise.all([
    User.findById(uid).select('name email photo createdAt').lean(),
    StudentProfile.findOne({ user: uid }).lean(),
  ]);

  let classTemplateGroup = 'UNASSIGNED';
  const templateGroups = await Group.find({ assignment: null, hostClass: cls._id })
    .select('name leader members')
    .lean();
  for (const g of templateGroups) {
    const memberIds = [
      String(g.leader || ''),
      ...(g.members || []).map((m) => String(m.user || '')),
    ].filter(Boolean);
    if (memberIds.includes(uid)) {
      classTemplateGroup = g.name || 'Group';
      break;
    }
  }

  const tid = new mongoose.Types.ObjectId(teacherId);
  const cid = cls._id;
  const assignments = await Assignment.find({
    teacher: tid,
    isActive: true,
    $or: [{ class: cid }, { classes: cid }],
  })
    .select('title submissionMode createdAt')
    .sort({ createdAt: -1 })
    .lean();

  const assignmentIds = assignments.map((a) => a._id);
  const [proposals, assignmentGroups, submissions] = await Promise.all([
    assignmentIds.length
      ? Proposal.find({ assignment: { $in: assignmentIds }, submittedBy: uid })
          .select('assignment status title updatedAt')
          .lean()
      : [],
    assignmentIds.length
      ? Group.find({ assignment: { $in: assignmentIds } })
          .select('name assignment leader members')
          .lean()
      : [],
    assignmentIds.length
      ? Proposal.find({ assignment: { $in: assignmentIds }, submittedBy: uid })
          .select('_id')
          .lean()
          .then(async (props) => {
            const pids = props.map((p) => p._id);
            if (!pids.length) return [];
            return ProjectSubmission.find({ proposal: { $in: pids } })
              .select('proposal version updatedAt originalFilename')
              .lean();
          })
      : [],
  ]);

  const proposalByAssignment = new Map(proposals.map((p) => [String(p.assignment), p]));
  const submissionByProposal = new Map(submissions.map((s) => [String(s.proposal), s]));

  const activities = assignments.map((a) => {
    const aid = String(a._id);
    const prop = proposalByAssignment.get(aid);
    let groupName = classTemplateGroup;
    if (a.submissionMode === 'group') {
      for (const g of assignmentGroups) {
        if (String(g.assignment) !== aid) continue;
        const memberIds = [
          String(g.leader || ''),
          ...(g.members || []).map((m) => String(m.user || '')),
        ].filter(Boolean);
        if (memberIds.includes(uid)) {
          groupName = g.name || 'Group';
          break;
        }
      }
    }
    const propId = prop ? String(prop._id) : null;
    const sub = propId ? submissionByProposal.get(propId) : null;
    return {
      assignmentId: aid,
      title: a.title || 'Assignment',
      submissionMode: a.submissionMode || 'group',
      groupName,
      proposalId: propId,
      proposalStatus: prop?.status || null,
      proposalTitle: prop?.title || null,
      proposalUpdatedAt: prop?.updatedAt || null,
      projectSubmitted: Boolean(sub),
      projectVersion: sub?.version ?? null,
      projectFilename: sub?.originalFilename || null,
    };
  });

  return {
    class: {
      _id: String(cls._id),
      code: cls.code,
      title: cls.name || cls.code,
    },
    student: {
      userId: uid,
      studentId: profile?.studentId || uid,
      name: user?.name || 'Student',
      email: user?.email || '',
      photo: user?.photo || '',
      program: profile?.program || '',
      faculty: cls?.faculty || profile?.faculty || '',
      classCode: profile?.classCode || cls.code,
      currentScore: profile?.currentScore ?? null,
      currentGpa: profile?.currentGpa ?? null,
      classTemplateGroup,
      memberSince: user?.createdAt || null,
    },
    activities,
  };
}

/** Group-mode assignments for this class (teacher-owned, active). */
export async function listGroupAssignmentsForClass(teacherId, classRef) {
  const cls = await resolveClassForTeacher(teacherId, classRef);
  if (!cls) {
    const err = new Error('Class not found');
    err.status = 404;
    throw err;
  }
  const tid = new mongoose.Types.ObjectId(teacherId);
  const cid = cls._id;
  const rows = await Assignment.find({
    teacher: tid,
    isActive: true,
    submissionMode: 'group',
    $or: [{ class: cid }, { classes: cid }],
  })
    .select('title submissionMode groupModeType createdAt')
    .sort({ createdAt: -1 })
    .lean();
  return rows.map((a) => ({
    _id: String(a._id),
    title: a.title || 'Assignment',
    submissionMode: a.submissionMode,
    groupModeType: a.groupModeType || 'fixed',
  }));
}

async function studentIdToUserIdMapForClassCodes(classCodes) {
  if (!classCodes.length) return new Map();
  const profiles = await StudentProfile.find({
    classCode: { $in: classCodes },
  })
    .select('user studentId classCode')
    .lean();
  const map = new Map();
  for (const p of profiles) {
    const sid = String(p.studentId || '').trim().toUpperCase();
    const uid = String(p.user || '');
    if (sid && uid) map.set(sid, new mongoose.Types.ObjectId(uid));
  }
  return map;
}

async function deleteOrphanGroupsForAssignment(assignmentId) {
  const groups = await Group.find({ assignment: assignmentId }).select('_id').lean();
  const deletable = [];
  for (const g of groups) {
    const has = await Proposal.exists({ group: g._id });
    if (!has) deletable.push(g._id);
  }
  if (deletable.length) {
    await Group.deleteMany({ _id: { $in: deletable } });
  }
  return { deletedCount: deletable.length };
}

/** Class-level team templates (no proposals linked). */
async function deleteClassTemplateGroups(hostClassId) {
  const res = await Group.deleteMany({ assignment: null, hostClass: hostClassId });
  return { deletedCount: res.deletedCount || 0 };
}

/**
 * Copy class-level team rows onto a group-mode assignment (new Group docs per assignment).
 * Runs after assignment create or when switching an assignment to group mode.
 */
export async function syncAssignmentGroupsFromClassTemplatesByAssignmentId(
  assignmentId,
  { onlyIfEmpty = true } = {}
) {
  const a = await Assignment.findOne({ _id: assignmentId, isActive: true }).lean();
  if (!a || a.submissionMode !== 'group') {
    return { synced: 0, reason: 'not_group_assignment' };
  }
  if (onlyIfEmpty) {
    const n = await Group.countDocuments({ assignment: a._id });
    if (n > 0) return { synced: 0, reason: 'assignment_already_has_groups' };
  }

  await deleteOrphanGroupsForAssignment(a._id);

  const classIds = [...new Set([String(a.class), ...(a.classes || []).map(String)].filter(Boolean))].map(
    (id) => new mongoose.Types.ObjectId(id)
  );
  if (!classIds.length) {
    return { synced: 0, reason: 'assignment_has_no_class' };
  }

  const templates = await Group.find({
    assignment: null,
    hostClass: { $in: classIds },
  }).lean();

  let sourceRows = templates;
  if (!sourceRows.length) {
    // Fallback: copy groups from another group assignment in the same class
    // (when teachers created teams only on one assignment, not as class templates).
    const peerAssignments = await Assignment.find({
      _id: { $ne: a._id },
      isActive: true,
      submissionMode: 'group',
      $or: [{ class: { $in: classIds } }, { classes: { $in: classIds } }],
    })
      .select('_id')
      .lean();
    const peerIds = peerAssignments.map((row) => row._id);
    if (peerIds.length) {
      sourceRows = await Group.find({ assignment: { $in: peerIds } }).lean();
      // Keep one row per leader so we do not duplicate teams across peer assignments.
      const byLeader = new Map();
      for (const row of sourceRows) {
        const key = String(row.leader?._id || row.leader || '');
        if (key && !byLeader.has(key)) byLeader.set(key, row);
      }
      sourceRows = [...byLeader.values()];
    }
  }

  let synced = 0;
  for (const t of sourceRows) {
    await Group.create({
      assignment: a._id,
      hostClass: null,
      name: t.name || 'Group',
      leader: t.leader,
      members: t.members || [],
    });
    synced += 1;
  }
  return { synced };
}

export async function syncAssignmentGroupsFromClassTemplates(
  teacherId,
  assignmentId,
  { onlyIfEmpty = true } = {}
) {
  const a = await Assignment.findOne({
    _id: assignmentId,
    isActive: true,
    $or: [
      { teacher: teacherId },
      { coTeacherId: teacherId },
      { frontendTeacherId: teacherId },
      { backendTeacherId: teacherId },
    ],
  }).lean();
  if (!a) {
    return { synced: 0, reason: 'assignment_not_found' };
  }
  return syncAssignmentGroupsFromClassTemplatesByAssignmentId(assignmentId, { onlyIfEmpty });
}

/**
 * Random teams on the class (no assignment yet). Uses every student tied to this class:
 * StudentProfile rows whose classCode matches, plus active Enrollment on this class (union, de-duplicated by user).
 */
export async function autoGenerateClassTemplateGroups(teacherId, classRef, { type = 'group', groupSize = 4 } = {}) {
  const cls = await resolveClassForTeacher(teacherId, classRef);
  if (!cls) {
    const err = new Error('Class not found');
    err.status = 404;
    throw err;
  }

  const rawCode = String(cls.code || '').trim();
  const codeUpper = rawCode.toUpperCase();
  if (!codeUpper) {
    const err = new Error('Class has no code');
    err.status = 400;
    throw err;
  }

  const { userIds, profileMatchCount, enrollmentMatchCount, uniqueStudentCount } =
    await collectRosterUserIdsForClassTemplate(cls);

  if (!userIds.length) {
    const err = new Error(
      'No students found for this class. Add students with this class on their profile or enroll them in this class.',
    );
    err.status = 400;
    throw err;
  }

  const alreadyGrouped = await collectAlreadyGroupedUserIdsForClass(cls, teacherId);
  const unassigned = userIds.filter((uid) => !alreadyGrouped.has(String(uid)));

  const size = type === 'individual' ? 1 : Math.max(2, Math.min(10, Number(groupSize) || 4));

  if (!unassigned.length) {
    return {
      createdCount: 0,
      groupSize: size,
      type,
      scope: 'class_template',
      studentCount: uniqueStudentCount,
      skippedAlreadyGrouped: userIds.length,
      unassignedStudentCount: 0,
      message: 'All students are already assigned to groups.',
      rosterBreakdown: {
        matchedProfiles: profileMatchCount,
        activeEnrollments: enrollmentMatchCount,
      },
    };
  }

  shuffleInPlace(unassigned);

  const existingTemplateCount = await Group.countDocuments({ assignment: null, hostClass: cls._id });
  const created = [];
  let idx = existingTemplateCount;
  for (let i = 0; i < unassigned.length; i += size) {
    idx += 1;
    const chunk = unassigned.slice(i, i + size);
    const leader = chunk[0];
    const members = chunk.slice(1).map((uid) => ({ user: uid }));
    const g = await Group.create({
      assignment: null,
      hostClass: cls._id,
      name: `Group ${idx}`,
      leader,
      members,
    });
    created.push(g);
  }

  const { synced: assignmentGroupsSynced } = await syncNewClassTemplatesToAssignments(teacherId, cls._id);

  return {
    createdCount: created.length,
    groupSize: size,
    type,
    scope: 'class_template',
    studentCount: uniqueStudentCount,
    skippedAlreadyGrouped: userIds.length - unassigned.length,
    unassignedStudentCount: unassigned.length,
    assignmentGroupsSynced,
    rosterBreakdown: {
      matchedProfiles: profileMatchCount,
      activeEnrollments: enrollmentMatchCount,
    },
  };
}

export async function exportClassTemplatesCsv(teacherId, classRef) {
  const cls = await resolveClassForTeacher(teacherId, classRef);
  if (!cls) {
    const err = new Error('Class not found');
    err.status = 404;
    throw err;
  }

  const groups = await Group.find({ assignment: null, hostClass: cls._id })
    .populate('leader', 'name email')
    .populate('members.user', 'name email')
    .lean();

  const userIds = new Set();
  for (const g of groups) {
    if (g.leader) userIds.add(String(g.leader._id || g.leader));
    for (const m of g.members || []) {
      const u = m.user?._id || m.user;
      if (u) userIds.add(String(u));
    }
  }
  const profiles = userIds.size
    ? await StudentProfile.find({ user: { $in: [...userIds] } }).select('user studentId').lean()
    : [];
  const sidByUser = new Map(profiles.map((p) => [String(p.user), String(p.studentId || '').trim()]));

  const lines = ['groupName,studentId,role'];
  for (const g of groups) {
    const gname = (g.name || 'Group').replace(/\r|\n/g, ' ');
    const lid = String(g.leader?._id || g.leader || '');
    const leaderSid = sidByUser.get(lid) || lid;
    lines.push([csvEscapeCell(gname), csvEscapeCell(leaderSid), 'leader'].join(','));
    for (const m of g.members || []) {
      const uid = String(m.user?._id || m.user || '');
      if (!uid || uid === lid) continue;
      const sid = sidByUser.get(uid) || uid;
      lines.push([csvEscapeCell(gname), csvEscapeCell(sid), 'member'].join(','));
    }
  }

  const safeCode = String(cls.code || 'class').replace(/[^\w\-]+/g, '_').slice(0, 60);
  return {
    filename: `class-teams-${safeCode}.csv`,
    csv: `${lines.join('\r\n')}\r\n`,
  };
}

export async function exportClassTemplatesXlsx(teacherId, classRef) {
  const { filename: csvName, csv } = await exportClassTemplatesCsv(teacherId, classRef);
  const matrix = csvTextToMatrix(csv);
  const buf = xlsxBufferFromMatrix(matrix);
  const base = String(csvName || 'class-teams.csv').replace(/\.csv$/i, '');
  const filename = `${base}.xlsx`;
  return { filename, xlsxBase64: buf.toString('base64') };
}

export async function previewClassTemplatesFromMatrix(teacherId, classRef, matrix) {
  const cls = await resolveClassForTeacher(teacherId, classRef);
  if (!cls) {
    const err = new Error('Class not found');
    err.status = 404;
    throw err;
  }

  const { roster, rosterCodes } = await loadRosterForClassTemplate(cls);
  const { byGroup, rejectedRows } = buildByGroupFromImportMatrix(matrix, roster);
  const { proposedGroups, skippedGroups } = splitProposedAndSkippedFromByGroup(byGroup);

  return {
    preview: true,
    proposedGroups,
    rejectedStudentRows: rejectedRows,
    skippedGroups,
    rosterClassCodes: rosterCodes,
    scope: 'class_template',
  };
}

export async function previewClassTemplatesFromCsv(teacherId, classRef, csvText) {
  return previewClassTemplatesFromMatrix(teacherId, classRef, csvTextToMatrix(csvText));
}

export async function previewClassTemplatesFromXlsxBuffer(teacherId, classRef, buffer) {
  return previewClassTemplatesFromMatrix(teacherId, classRef, xlsxBufferToMatrix(buffer));
}

export async function commitClassTemplateProposals(teacherId, classRef, proposedGroups) {
  const cls = await resolveClassForTeacher(teacherId, classRef);
  if (!cls) {
    const err = new Error('Class not found');
    err.status = 404;
    throw err;
  }

  const { roster, rosterCodes } = await loadRosterForClassTemplate(cls);
  const { byGroup, rejectedRows } = materializeClassTemplateProposals(proposedGroups, roster);
  if (rejectedRows.length) {
    const err = new Error(
      'Could not apply this import: roster validation failed. Run preview again or fix student IDs.',
    );
    err.status = 400;
    throw err;
  }

  const { templateGroupsRemoved, createdGroups, skippedGroups } = await persistClassTemplateGroupsFromByGroup(
    cls,
    byGroup,
  );

  return {
    templateGroupsRemoved,
    createdGroups,
    rejectedStudentRows: [],
    skippedGroups,
    rosterClassCodes: rosterCodes,
    scope: 'class_template',
    applied: true,
  };
}

export async function importClassTemplatesFromMatrix(teacherId, classRef, matrix) {
  const previewData = await previewClassTemplatesFromMatrix(teacherId, classRef, matrix);
  return commitClassTemplateProposals(teacherId, classRef, previewData.proposedGroups);
}

export async function importClassTemplatesFromCsv(teacherId, classRef, csvText) {
  return importClassTemplatesFromMatrix(teacherId, classRef, csvTextToMatrix(csvText));
}

export async function importClassTemplatesFromXlsxBuffer(teacherId, classRef, buffer) {
  return importClassTemplatesFromMatrix(teacherId, classRef, xlsxBufferToMatrix(buffer));
}

/**
 * Randomly form groups for a group-mode assignment from class roster (student profiles on assignment class codes).
 */
export async function autoGenerateGroupsForAssignment(teacherId, assignmentId, { type = 'group', groupSize = 4 } = {}) {
  const a = await Assignment.findOne({ _id: assignmentId, teacher: teacherId, isActive: true })
    .populate('class', 'code')
    .populate('classes', 'code')
    .lean();
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

  const codes = assignmentClassCodesFromDoc(a);
  if (!codes.length) {
    const err = new Error('Assignment has no class codes; cannot build roster');
    err.status = 400;
    throw err;
  }

  const profiles = await StudentProfile.find({ classCode: { $in: codes } })
    .populate('user', 'name email')
    .lean();
  const userIds = [...new Set(profiles.map((p) => String(p.user?._id || p.user)).filter(Boolean))].map(
    (id) => new mongoose.Types.ObjectId(id)
  );

  if (!userIds.length) {
    const err = new Error('No students found on the class roster for this assignment');
    err.status = 400;
    throw err;
  }

  const existingGroups = await Group.find({ assignment: a._id }).select('leader members').lean();
  const alreadyGrouped = new Set();
  for (const g of existingGroups) {
    memberUserIdsFromGroupLean(g).forEach((id) => alreadyGrouped.add(id));
  }

  const unassigned = userIds.filter((uid) => !alreadyGrouped.has(String(uid)));
  const size = type === 'individual' ? 1 : Math.max(2, Math.min(10, Number(groupSize) || 4));

  if (!unassigned.length) {
    return {
      createdCount: 0,
      groupSize: size,
      type,
      skippedAlreadyGrouped: userIds.length,
      unassignedStudentCount: 0,
      message: 'All students are already assigned to groups on this assignment.',
    };
  }

  shuffleInPlace(unassigned);

  const created = [];
  let idx = existingGroups.length;
  for (let i = 0; i < unassigned.length; i += size) {
    idx += 1;
    const chunk = unassigned.slice(i, i + size);
    const leader = chunk[0];
    const members = chunk.slice(1).map((uid) => ({ user: uid }));
    const g = await Group.create({
      assignment: a._id,
      name: `Group ${idx}`,
      leader,
      members,
    });
    created.push(g);
  }

  return {
    createdCount: created.length,
    groupSize: size,
    type,
    skippedAlreadyGrouped: userIds.length - unassigned.length,
    unassignedStudentCount: unassigned.length,
  };
}

export async function exportGroupsCsvForAssignment(teacherId, assignmentId) {
  const a = await Assignment.findOne({ _id: assignmentId, teacher: teacherId, isActive: true }).lean();
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

  const groups = await Group.find({ assignment: assignmentId }).populate('leader', 'name email').populate('members.user', 'name email').lean();

  const userIds = new Set();
  for (const g of groups) {
    if (g.leader) userIds.add(String(g.leader._id || g.leader));
    for (const m of g.members || []) {
      const u = m.user?._id || m.user;
      if (u) userIds.add(String(u));
    }
  }
  const profiles = userIds.size
    ? await StudentProfile.find({ user: { $in: [...userIds] } }).select('user studentId').lean()
    : [];
  const sidByUser = new Map(profiles.map((p) => [String(p.user), String(p.studentId || '').trim()]));

  const lines = ['groupName,studentId,role'];
  for (const g of groups) {
    const gname = (g.name || 'Group').replace(/\r|\n/g, ' ');
    const lid = String(g.leader?._id || g.leader || '');
    const leaderSid = sidByUser.get(lid) || lid;
    lines.push([csvEscapeCell(gname), csvEscapeCell(leaderSid), 'leader'].join(','));
    for (const m of g.members || []) {
      const uid = String(m.user?._id || m.user || '');
      if (!uid || uid === lid) continue;
      const sid = sidByUser.get(uid) || uid;
      lines.push([csvEscapeCell(gname), csvEscapeCell(sid), 'member'].join(','));
    }
  }

  const safeTitle = String(a.title || 'assignment').replace(/[^\w\-]+/g, '_').slice(0, 60);
  return {
    filename: `groups-${safeTitle}-${assignmentId}.csv`,
    csv: `${lines.join('\r\n')}\r\n`,
  };
}

export async function exportGroupsXlsxForAssignment(teacherId, assignmentId) {
  const { filename: csvName, csv } = await exportGroupsCsvForAssignment(teacherId, assignmentId);
  const matrix = csvTextToMatrix(csv);
  const buf = xlsxBufferFromMatrix(matrix);
  const base = String(csvName || 'groups.csv').replace(/\.csv$/i, '');
  const filename = `${base}.xlsx`;
  return { filename, xlsxBase64: buf.toString('base64') };
}

/**
 * Import groups from CSV. studentId must match StudentProfile.studentId for a student in the assignment's class(es).
 * Unknown IDs are rejected; each group is still created with valid members only.
 * Deletes existing groups on this assignment that have no linked Proposal before creating new ones.
 */
export async function importGroupsFromMatrixForAssignment(teacherId, assignmentId, matrix) {
  const a = await Assignment.findOne({ _id: assignmentId, teacher: teacherId, isActive: true })
    .populate('class', 'code')
    .populate('classes', 'code')
    .lean();
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

  const codes = assignmentClassCodesFromDoc(a);
  if (!codes.length) {
    const err = new Error('Assignment has no class codes');
    err.status = 400;
    throw err;
  }

  const roster = await studentIdToUserIdMapForClassCodes(codes);

  const { byGroup, rejectedRows } = buildByGroupFromImportMatrix(matrix, roster);

  const orphanInfo = await deleteOrphanGroupsForAssignment(a._id);

  const createdGroups = [];
  const skippedGroups = [];

  for (const [gname, rows] of byGroup.entries()) {
    if (!rows.length) {
      skippedGroups.push({ groupName: gname, reason: 'no_valid_students' });
      continue;
    }
    let leaderRow = rows.find((r) => r.role === 'leader');
    if (!leaderRow) leaderRow = rows[0];
    const leader = leaderRow.userId;
    const memberRows = rows.filter((r) => String(r.userId) !== String(leader));
    const members = memberRows.map((r) => ({ user: r.userId }));

    const g = await Group.create({
      assignment: a._id,
      name: gname,
      leader,
      members,
    });
    createdGroups.push({ _id: String(g._id), name: g.name, memberCount: 1 + members.length });
  }

  return {
    orphanGroupsRemoved: orphanInfo.deletedCount,
    createdGroups,
    rejectedStudentRows: rejectedRows,
    skippedGroups,
    rosterClassCodes: codes,
  };
}

export async function importGroupsFromCsvForAssignment(teacherId, assignmentId, csvText) {
  return importGroupsFromMatrixForAssignment(teacherId, assignmentId, csvTextToMatrix(csvText));
}

export async function importGroupsFromXlsxBufferForAssignment(teacherId, assignmentId, buffer) {
  return importGroupsFromMatrixForAssignment(teacherId, assignmentId, xlsxBufferToMatrix(buffer));
}

/** Same project cards shape as listAllGroupsForTeacher, filtered to one class code. */
export async function listGroupsDisplayForClass(teacherId, classRef) {
  const cls = await resolveClassForTeacher(teacherId, classRef);
  if (!cls) {
    const err = new Error('Class not found');
    err.status = 404;
    throw err;
  }
  const tid = new mongoose.Types.ObjectId(teacherId);
  const cid = cls._id;
  const assignments = await Assignment.find({
    teacher: tid,
    isActive: true,
    submissionMode: 'group',
    $or: [{ class: cid }, { classes: cid }],
  })
    .populate('class', 'code name')
    .populate('subject', 'code name')
    .lean();

  const assignmentIds = assignments.map((x) => x._id);
  const assignmentMap = new Map(assignments.map((x) => [String(x._id), x]));

  const templateRows = await Group.find({ assignment: null, hostClass: cid })
    .populate('leader', 'name photo')
    .populate('members.user', 'name photo')
    .lean();

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

  const proposalByGroup = new Map(proposals.filter((p) => p.group).map((p) => [String(p.group), p]));
  const memberUserIds = [...groups, ...templateRows]
    .flatMap((g) => [g.leader, ...(g.members || []).map((m) => m.user)])
    .map((u) => String(u?._id || u))
    .filter(Boolean);
  const memberProfiles = memberUserIds.length
    ? await StudentProfile.find({ user: { $in: memberUserIds } }).select('user studentId').lean()
    : [];
  const studentIdByUser = new Map(memberProfiles.map((p) => [String(p.user), p.studentId || '']));

  const projects = [];
  const seenAssignmentMemberKeys = new Set();

  function pushFromTemplate(group) {
    const members = mapGroupMembersForTeacherCard(group, studentIdByUser);
    projects.push({
      _id: group._id,
      title: group.name || 'Class team',
      members,
      type: 'group',
      assignmentNumber: String(group._id).slice(-4).toUpperCase(),
      status: 'CLASS_TEAM',
      similarity: 0,
      similarityLevel: 'Low',
      isClassTeamTemplate: true,
    });
  }

  for (const group of templateRows) {
    if (classTemplateDuplicatesAssignmentGroup(group, groups)) continue;
    pushFromTemplate(group);
  }

  for (const group of groups) {
    const assignment = assignmentMap.get(String(group.assignment));
    if (!assignment) continue;
    if (!assignmentIncludesClassCode(assignment, cls.code)) continue;
    const memberKey = memberSetKeyFromGroupLean(group);
    if (memberKey && seenAssignmentMemberKeys.has(memberKey)) continue;
    if (memberKey) seenAssignmentMemberKeys.add(memberKey);
    const proposal = proposalByGroup.get(String(group._id));
    const members = mapGroupMembersForTeacherCard(group, studentIdByUser);
    const similarity = Math.round(Number(proposal?.aiPreviousSemesterMaxScore || proposal?.aiSameSemesterMaxScore || 0) * 100);
    projects.push({
      _id: group._id,
      title: proposal?.title || assignment.title || group.name || 'Project',
      members,
      type: assignment.submissionMode === 'single' ? 'individual' : 'group',
      assignmentNumber: String(group._id).slice(-4).toUpperCase(),
      status: (proposal?.status || 'draft').toUpperCase(),
      similarity,
      similarityLevel: similarity >= 58 ? 'High' : 'Low',
    });
  }
  return projects;
}

/**
 * Without assignmentId: build/update **class-level** teams (no assignment needed yet).
 * With assignmentId: regenerate groups on that group-mode assignment only.
 */
export async function generateGroupsForClassRoute(teacherId, classRef, body) {
  const { type = 'group', groupSize = 4, assignmentId: aidBody } = body || {};
  const cls = await resolveClassForTeacher(teacherId, classRef);
  if (!cls) {
    const err = new Error('Class not found');
    err.status = 404;
    throw err;
  }

  if (!aidBody) {
    return autoGenerateClassTemplateGroups(teacherId, classRef, { type, groupSize });
  }

  return autoGenerateGroupsForAssignment(teacherId, aidBody, { type, groupSize });
}
