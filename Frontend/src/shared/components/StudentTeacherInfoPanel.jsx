import React from 'react';
import { Mail, UserRound } from 'lucide-react';
import { getApiOrigin } from '../../lib/api';
import { resolveProfilePhotoUrl, teacherInitials } from '../utils/profilePhoto';
import { Z_CARD } from '../ui/zendentaLayout';

export function TeacherCard({ teacher, size = 'md' }) {
  const apiOrigin = getApiOrigin();
  const photoUrl = resolveProfilePhotoUrl(teacher?.photo, apiOrigin);
  const name = teacher?.name || 'Teacher';
  const small = size === 'sm';

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className={`relative shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-[#1e56e3] to-[#3b74ff] shadow-md ring-2 ring-white ${
          small ? 'h-11 w-11' : 'h-14 w-14'
        }`}
      >
        {photoUrl ? (
          <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span
            className={`flex h-full w-full items-center justify-center font-bold text-white ${
              small ? 'text-base' : 'text-lg'
            }`}
          >
            {teacherInitials(name)}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {teacher?.roleLabel ? (
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#1e56e3]">{teacher.roleLabel}</p>
        ) : null}
        <p className="truncate text-sm font-bold text-slate-900">{name}</p>
        {teacher?.department ? (
          <p className="truncate text-xs font-medium text-slate-500">{teacher.department}</p>
        ) : null}
        {teacher?.email ? (
          <a
            href={`mailto:${teacher.email}`}
            className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs font-semibold text-[#1e56e3] hover:underline"
          >
            <Mail className="h-3 w-3 shrink-0" />
            {teacher.email}
          </a>
        ) : null}
        {teacher?.employeeId ? (
          <p className="text-[11px] text-slate-400">ID: {teacher.employeeId}</p>
        ) : null}
      </div>
    </div>
  );
}

/** Resolve all teachers for display (handles collaborative + legacy assignments). */
export function resolveAssignmentTeachers(assignment) {
  if (!assignment) return [];

  if (Array.isArray(assignment.teachers) && assignment.teachers.length > 1) {
    return assignment.teachers;
  }

  const seen = new Set();
  const list = [];
  const add = (ref, roleLabel) => {
    if (!ref) return;
    if (typeof ref === 'object' && !ref.name && ref._id) return;
    if (typeof ref !== 'object') return;
    const id = String(ref._id || ref.id || ref.name);
    if (seen.has(id)) return;
    seen.add(id);
    list.push({ ...ref, roleLabel });
  };

  const dual =
    assignment.isCollaborative ||
    assignment.coTeacherId ||
    (assignment.frontendTeacherId && assignment.backendTeacherId);

  if (dual) {
    add(assignment.frontendTeacherId || assignment.teacher, 'Frontend teacher');
    add(assignment.backendTeacherId || assignment.coTeacherId, 'Backend teacher');
  } else if (Array.isArray(assignment.teachers) && assignment.teachers.length) {
    return assignment.teachers;
  } else {
    add(assignment.teacher, 'Teacher');
    add(assignment.coTeacherId, 'Co-teacher');
  }

  return list;
}

/** Shows assignment teacher(s) — name, photo, email — always visible to students. */
export default function StudentTeacherInfoPanel({
  teachers = [],
  assignmentTitle,
  compact = false,
  embedded = false,
}) {
  const list = Array.isArray(teachers) && teachers.length ? teachers : [];
  if (!list.length) return null;

  const inner = (
    <>
      {!compact ? (
        <div className="mb-3 flex items-center gap-2">
          <UserRound className="h-4 w-4 text-[#1e56e3]" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">Your teacher{list.length > 1 ? 's' : ''}</h2>
            {assignmentTitle ? (
              <p className="text-xs text-slate-500">For assignment: {assignmentTitle}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">
          {list.length > 1 ? 'Teachers' : 'Teacher'}
        </p>
      )}
      <div className={`grid gap-4 ${list.length > 1 && !compact ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
        {list.map((t) => (
          <TeacherCard key={`${t._id}-${t.roleLabel}`} teacher={t} size={compact ? 'sm' : 'md'} />
        ))}
      </div>
    </>
  );

  if (embedded) return inner;

  return (
    <div className={`${Z_CARD} mb-4 border-[#1e56e3]/15 bg-gradient-to-r from-blue-50/80 to-white p-4`}>
      {inner}
    </div>
  );
}
