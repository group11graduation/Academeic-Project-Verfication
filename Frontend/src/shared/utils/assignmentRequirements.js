/** Client-side validation mirroring backend assignment requirement rules. */
import { validateAssignmentTechnologyConsistency } from './techRequirements';

export function validateAssignmentRequirementsForm({
  assignmentType = 'normal',
  requirementText = '',
  allowedTechnologiesText = '',
  requirementsFile = null,
  hasExistingFile = false,
  subject = null,
  title = '',
  description = '',
  isCollaborative = false,
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
  } else if (hasFile) {
    // Final assignment with file — no typed tech list required.
  } else if (!text) {
    return 'Requirement text is required unless you upload a requirements file.';
  } else if (techs.length === 0) {
    return 'At least one allowed technology is required unless you upload a requirements file.';
  }

  const consistency = validateAssignmentTechnologyConsistency({
    subject,
    title,
    description,
    requirementText: text,
    allowedTechnologiesText,
    isCollaborative,
  });
  if (!consistency.ok) {
    return consistency.message;
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
      subject: assignment.subject || null,
      title: assignment.title || '',
      description: assignment.description || '',
    }) === null
  );
}
