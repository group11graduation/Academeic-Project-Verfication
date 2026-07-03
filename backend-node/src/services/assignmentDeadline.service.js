export function parseDeadline(value) {
  if (value == null || value === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isDeadlinePassed(deadline, now = new Date()) {
  const d = parseDeadline(deadline);
  if (!d) return false;
  return now > d;
}

function sameDeadlineInstant(a, b) {
  const ta = parseDeadline(a)?.getTime();
  const tb = parseDeadline(b)?.getTime();
  if (ta == null || tb == null) return false;
  return ta === tb;
}

/**
 * When a teacher sets or changes a deadline it must be strictly in the future.
 * Unchanged deadlines (including ones already passed) are allowed so other fields can be edited.
 */
export function assertTeacherDeadlineChange({ newValue, previousValue, label }) {
  if (newValue == null || newValue === '') return;
  const next = parseDeadline(newValue);
  if (!next) {
    const err = new Error(`Invalid ${label}.`);
    err.status = 400;
    throw err;
  }
  if (previousValue != null && sameDeadlineInstant(newValue, previousValue)) return;
  if (next.getTime() <= Date.now()) {
    const err = new Error(`${label} must be after the current date and time.`);
    err.status = 400;
    throw err;
  }
}

export function validateDeadlinesOnCreate({ assignmentType = 'normal', proposalDeadline, projectDeadline } = {}) {
  const type = String(assignmentType || 'normal').trim().toLowerCase();

  if (type === 'normal') {
    if (projectDeadline) {
      assertTeacherDeadlineChange({
        newValue: projectDeadline,
        previousValue: null,
        label: 'Submission deadline',
      });
    }
    return;
  }

  if (proposalDeadline) {
    assertTeacherDeadlineChange({
      newValue: proposalDeadline,
      previousValue: null,
      label: 'Proposal deadline',
    });
  }
  if (projectDeadline) {
    assertTeacherDeadlineChange({
      newValue: projectDeadline,
      previousValue: null,
      label: 'Project deadline',
    });
  }

  const proposalDate = parseDeadline(proposalDeadline);
  const projectDate = parseDeadline(projectDeadline);
  if (proposalDate && projectDate && projectDate < proposalDate) {
    const err = new Error('Project deadline must be on or after the proposal deadline.');
    err.status = 400;
    throw err;
  }
}

export function validateDeadlinesOnUpdate(assignment, payload = {}) {
  const type = String(payload.assignmentType ?? assignment?.assignmentType ?? 'normal')
    .trim()
    .toLowerCase();

  if ('proposalDeadline' in payload && type === 'final' && payload.proposalDeadline) {
    assertTeacherDeadlineChange({
      newValue: payload.proposalDeadline,
      previousValue: assignment?.proposalDeadline,
      label: 'Proposal deadline',
    });
  }

  if ('projectDeadline' in payload && payload.projectDeadline) {
    assertTeacherDeadlineChange({
      newValue: payload.projectDeadline,
      previousValue: assignment?.projectDeadline,
      label: type === 'normal' ? 'Submission deadline' : 'Project deadline',
    });
  }

  const nextProposal =
    'proposalDeadline' in payload
      ? parseDeadline(payload.proposalDeadline)
      : parseDeadline(assignment?.proposalDeadline);
  const nextProject =
    'projectDeadline' in payload
      ? parseDeadline(payload.projectDeadline)
      : parseDeadline(assignment?.projectDeadline);

  if (type === 'final' && nextProposal && nextProject && nextProject < nextProposal) {
    const err = new Error('Project deadline must be on or after the proposal deadline.');
    err.status = 400;
    throw err;
  }
}

export const PROPOSAL_DEADLINE_PASSED_MESSAGE =
  'Proposal deadline has passed. Submission is closed. Ask your teacher to extend the deadline via Edit assignment.';

export const PROJECT_DEADLINE_PASSED_MESSAGE =
  'Project deadline has passed. Submission is closed. Ask your teacher to extend the deadline via Edit assignment.';

export const NORMAL_DEADLINE_PASSED_MESSAGE =
  'Submission deadline has passed. Submission is closed. Ask your teacher to extend the deadline via Edit assignment.';
