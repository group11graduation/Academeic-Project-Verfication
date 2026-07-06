export function datetimeLocalMin() {
    const now = new Date();
    now.setSeconds(0, 0);
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
}

export function isDeadlinePassed(deadline) {
    if (!deadline) return false;
    return new Date() > new Date(deadline);
}

export function validateFutureDeadline(value, label) {
    if (!value) return null;
    if (new Date(value).getTime() <= Date.now()) {
        return `${label} must be after the current date and time.`;
    }
    return null;
}

export function validateAssignmentDeadlinesForm({
    assignmentType,
    proposalDeadline,
    projectDeadline,
    normalSubmissionDeadline,
    isEdit = false,
    initialProposalDeadline = null,
    initialProjectDeadline = null,
    initialNormalDeadline = null,
}) {
    const type = String(assignmentType || 'normal').toLowerCase();
    const unchanged = (value, initial) => {
        if (!isEdit || !initial || !value) return false;
        return new Date(value).getTime() === new Date(initial).getTime();
    };

    if (type === 'normal') {
        if (normalSubmissionDeadline && !unchanged(normalSubmissionDeadline, initialNormalDeadline)) {
            const err = validateFutureDeadline(normalSubmissionDeadline, 'Submission deadline');
            if (err) return err;
        }
        return null;
    }

    if (proposalDeadline && !unchanged(proposalDeadline, initialProposalDeadline)) {
        const err = validateFutureDeadline(proposalDeadline, 'Proposal deadline');
        if (err) return err;
    }
    if (projectDeadline && !unchanged(projectDeadline, initialProjectDeadline)) {
        const err = validateFutureDeadline(projectDeadline, 'Project deadline');
        if (err) return err;
    }
    if (proposalDeadline && projectDeadline) {
        if (new Date(projectDeadline) < new Date(proposalDeadline)) {
            return 'Project deadline must be on or after the proposal deadline.';
        }
    }
    if (!isEdit) {
        if (proposalDeadline) {
            const err = validateFutureDeadline(proposalDeadline, 'Proposal deadline');
            if (err) return err;
        }
        if (projectDeadline) {
            const err = validateFutureDeadline(projectDeadline, 'Project deadline');
            if (err) return err;
        }
    }
    return null;
}

export const DEADLINE_DUE_STUDENT_MESSAGE =
    'Deadline due — submission is closed. Contact your teacher to request an extension.';

/** Student already submitted a proposal (any state past draft). */
export function isProposalPhaseComplete(row) {
    const status = row?.proposal?.status;
    if (!status || status === 'draft') return false;
    return true;
}

/** Show red proposal deadline banner only when the student has not submitted a proposal yet. */
export function shouldShowProposalDeadlineWarning(row) {
    return Boolean(row?.proposalDeadlinePassed) && !isProposalPhaseComplete(row);
}

/** Show red project deadline banner only when the project ZIP was never uploaded. */
export function shouldShowProjectDeadlineWarning(row) {
    return Boolean(row?.projectDeadlinePassed) && !row?.latestProjectSubmission;
}

/** Show red normal-assignment deadline banner only when no file was uploaded. */
export function shouldShowNormalDeadlineWarning(row) {
    return Boolean(row?.submissionDeadlinePassed) && !row?.latestNormalSubmission;
}
