/** Client-side validation mirroring backend assignment requirement rules. */
export function validateAssignmentRequirementsForm({
  assignmentType = 'normal',
  requirementText = '',
  allowedTechnologiesText = '',
  requirementsFile = null,
  hasExistingFile = false,
} = {}) {
  const hasFile = Boolean(requirementsFile) || Boolean(hasExistingFile);
  const text = String(requirementText || '').trim();
  const techs = String(allowedTechnologiesText || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

  if (assignmentType === 'normal') {
    if (!text && !hasFile) {
      return 'Add instructions for students (requirement text) or upload a requirements file.';
    }
    return null;
  }

  if (hasFile) return null;

  if (!text) {
    return 'Requirement text is required unless you upload a requirements file.';
  }

  if (techs.length === 0) {
    return 'At least one allowed technology is required unless you upload a requirements file.';
  }

  return null;
}

export function assignmentRequirementsComplete(assignment) {
  if (!assignment || assignment.isCollaborative) return true;
  return (
    validateAssignmentRequirementsForm({
      assignmentType: assignment.assignmentType || 'normal',
      requirementText: assignment.requirementText || '',
      allowedTechnologiesText: Array.isArray(assignment.allowedTechnologies)
        ? assignment.allowedTechnologies.join(', ')
        : '',
      hasExistingFile: Boolean(assignment.assignmentFile),
    }) === null
  );
}
