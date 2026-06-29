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
