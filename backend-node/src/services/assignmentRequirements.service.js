function parseList(value) {
  if (Array.isArray(value)) return value.map((x) => String(x || '').trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((x) => x.trim()).filter(Boolean);
  return [];
}

/**
 * Final assignments need either a requirements file OR (requirement text + allowed technologies).
 * Normal assignments need requirement text OR a requirements file.
 */
export function validateAssignmentRequirementsConfig({
  assignmentType = 'normal',
  requirementText = '',
  allowedTechnologies,
  allowedTechnologiesText,
  assignmentFile = '',
  isCollaborative = false,
} = {}) {
  if (isCollaborative) {
    return { ok: true };
  }

  const type = String(assignmentType || 'normal').trim().toLowerCase();
  const text = String(requirementText || '').trim();
  const techs = parseList(allowedTechnologies ?? allowedTechnologiesText);
  const hasFile = Boolean(String(assignmentFile || '').trim());

  if (type === 'normal') {
    if (!text && !hasFile) {
      return {
        ok: false,
        message:
          'Normal assignments require student instructions (requirement text) or an uploaded requirements file before students can submit.',
      };
    }
    return { ok: true };
  }

  if (hasFile) {
    return { ok: true };
  }

  if (!text) {
    return {
      ok: false,
      message:
        'Final assignments require a requirements file, or requirement text plus at least one allowed technology.',
    };
  }

  if (techs.length === 0) {
    return {
      ok: false,
      message:
        'Final assignments require at least one allowed technology when using typed requirements (or upload a requirements file instead).',
    };
  }

  return { ok: true };
}

export function assertAssignmentRequirementsConfigured(fields) {
  const result = validateAssignmentRequirementsConfig(fields);
  if (!result.ok) {
    const err = new Error(result.message);
    err.status = 400;
    throw err;
  }
}

export function assignmentAcceptsStudentSubmissions(assignment) {
  if (!assignment) return false;
  return validateAssignmentRequirementsConfig({
    assignmentType: assignment.assignmentType,
    requirementText: assignment.requirementText,
    allowedTechnologies: assignment.allowedTechnologies,
    assignmentFile: assignment.assignmentFile,
    isCollaborative: assignment.isCollaborative,
  }).ok;
}

export const STUDENT_SUBMISSION_BLOCKED_MESSAGE =
  'This assignment is not open for submissions yet. Your teacher must add requirement text and allowed technologies, or upload a requirements file.';

export function assertAssignmentAcceptsStudentSubmissions(assignment) {
  if (!assignmentAcceptsStudentSubmissions(assignment)) {
    const err = new Error(STUDENT_SUBMISSION_BLOCKED_MESSAGE);
    err.status = 403;
    throw err;
  }
}
