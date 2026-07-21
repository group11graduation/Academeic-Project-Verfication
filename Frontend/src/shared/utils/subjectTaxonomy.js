/** Resolve faculty names on a subject (supports legacy singular + new arrays). */
export function getSubjectFaculties(subject = {}) {
  const fromArray = Array.isArray(subject.faculties)
    ? subject.faculties.map((v) => String(v || '').trim()).filter(Boolean)
    : [];
  if (fromArray.length) return fromArray;
  const legacy = String(subject.faculty || '').trim();
  return legacy ? [legacy] : [];
}

/** Resolve department names on a subject (supports legacy singular + new arrays). */
export function getSubjectDepartments(subject = {}) {
  const fromArray = Array.isArray(subject.departments)
    ? subject.departments.map((v) => String(v || '').trim()).filter(Boolean)
    : [];
  if (fromArray.length) return fromArray;
  const legacy = String(subject.department || '').trim();
  return legacy ? [legacy] : [];
}

export function subjectMatchesFaculty(subject, facultyName) {
  const target = String(facultyName || '').trim().toLowerCase();
  if (!target) return true;
  return getSubjectFaculties(subject).some((f) => f.toLowerCase() === target);
}

export function subjectMatchesDepartment(subject, departmentName) {
  const target = String(departmentName || '').trim().toLowerCase();
  if (!target) return true;
  return getSubjectDepartments(subject).some((d) => d.toLowerCase() === target);
}
