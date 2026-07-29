/**
 * Primary class crumb for teacher assignment breadcrumbs.
 * Links back to Assignments with that class selected.
 */
export function resolveAssignmentClassCrumb(assignment) {
  const rows =
    Array.isArray(assignment?.classes) && assignment.classes.length
      ? assignment.classes
      : assignment?.class
        ? [assignment.class]
        : [];
  const primary = rows[0];
  if (!primary) return null;

  const id = String(primary._id || primary || '').trim();
  if (!id || id === 'undefined' || id === 'null') return null;

  const code = String(primary.code || '').trim();
  const name = String(primary.name || '').trim();
  const label = [code, name].filter(Boolean).join(' — ') || 'Class';

  return {
    id,
    label,
    to: `/teacher/assignments?classId=${encodeURIComponent(id)}`,
  };
}
