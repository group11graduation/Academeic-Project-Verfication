import mongoose from 'mongoose';
import { Assignment } from '../models/Assignment.js';

/**
 * Mongo filter so an assignment appears on both the primary teacher's and co-teacher's dashboards.
 */
export function teacherAssignmentVisibilityFilter(teacherId, extra = {}) {
  const tid = new mongoose.Types.ObjectId(teacherId);
  const { $or: extraOr, ...rest } = extra;
  const teacherOr = [{ teacher: tid }, { coTeacherId: tid }];
  if (Array.isArray(extraOr) && extraOr.length) {
    return {
      ...rest,
      $and: [{ $or: teacherOr }, { $or: extraOr }],
    };
  }
  return {
    ...rest,
    $or: teacherOr,
  };
}

export async function findAssignmentVisibleToTeacher(teacherId, assignmentId, extra = {}) {
  return Assignment.findOne({
    _id: assignmentId,
    ...teacherAssignmentVisibilityFilter(teacherId, extra),
  });
}

export async function distinctAssignmentIdsForTeacher(teacherId, extra = {}) {
  return Assignment.find(teacherAssignmentVisibilityFilter(teacherId, extra)).distinct('_id');
}

/** Primary teacher retains exclusive control over destructive edits. */
export function teacherCanManageAssignment(teacherId, assignment) {
  if (!assignment) return false;
  return String(assignment.teacher?._id || assignment.teacher) === String(teacherId);
}

export function resolveCollaborationRole(teacherId, assignment) {
  if (!assignment?.isCollaborative) return null;
  if (String(assignment.teacher?._id || assignment.teacher) === String(teacherId)) return 'primary';
  if (String(assignment.coTeacherId?._id || assignment.coTeacherId) === String(teacherId)) return 'co-teacher';
  return null;
}

function idOf(value) {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

/** Which collaborative review slot (frontend/backend) the teacher owns. */
export function resolveCollaborativeReviewRole(teacherId, assignment) {
  if (!assignment?.isCollaborative) return null;
  const tid = idOf(teacherId);
  const frontendId = idOf(assignment.frontendTeacherId || assignment.teacher);
  const backendId = idOf(assignment.backendTeacherId || assignment.coTeacherId);
  if (tid && tid === frontendId) return 'frontend';
  if (tid && tid === backendId) return 'backend';
  return null;
}

export function getCollaborativeTeacherIds(assignment) {
  return {
    frontendId: idOf(assignment?.frontendTeacherId || assignment?.teacher),
    backendId: idOf(assignment?.backendTeacherId || assignment?.coTeacherId),
  };
}

/** Primary teacher, co-teacher, or collaborative frontend/backend reviewer may review proposals and previews. */
export function teacherCanAccessAssignmentReview(teacherId, assignment) {
  if (!assignment) return false;
  const tid = String(teacherId);
  if (String(assignment.teacher?._id || assignment.teacher) === tid) return true;
  if (assignment.coTeacherId && String(assignment.coTeacherId?._id || assignment.coTeacherId) === tid) {
    return true;
  }
  const { frontendId, backendId } = getCollaborativeTeacherIds(assignment);
  if (frontendId && frontendId === tid) return true;
  if (backendId && backendId === tid) return true;
  return false;
}
