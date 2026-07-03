const TERMINAL_PROPOSAL_STATUSES = new Set([
  'teacher_rejected',
  'revision_required',
  'requirements_rejected',
  'ai_rejected_same_semester',
  'ai_flagged_previous_semester',
  'draft',
]);

/**
 * Derive collaborative review + display status for teacher/student UI.
 * Stored status may be teacher_approved from legacy single-teacher approve — treat as pending until both slots approve.
 */
export function getCollaborativeReviewState(proposal, assignment) {
  const isCollaborative = Boolean(assignment?.isCollaborative && assignment?.coTeacherId);
  if (!isCollaborative) {
    return {
      isCollaborative: false,
      frontendApproved: false,
      backendApproved: false,
      dualComplete: true,
      awaitingDualApproval: false,
      displayStatus: proposal?.status,
    };
  }

  const reviews = proposal?.collaborativeTeacherReviews || { frontend: {}, backend: {} };
  const frontendApproved = reviews?.frontend?.action === 'approve';
  const backendApproved = reviews?.backend?.action === 'approve';
  const dualComplete = frontendApproved && backendApproved;
  const terminal = TERMINAL_PROPOSAL_STATUSES.has(proposal?.status);

  let displayStatus = proposal?.status;
  if (!terminal) {
    if (dualComplete) {
      displayStatus = 'teacher_approved';
    } else if (['teacher_approved', 'pending_teacher_approval', 'submitted'].includes(proposal?.status)) {
      displayStatus = 'pending_teacher_approval';
    }
  }

  return {
    isCollaborative: true,
    frontendApproved,
    backendApproved,
    dualComplete,
    awaitingDualApproval: !dualComplete && !terminal && displayStatus === 'pending_teacher_approval',
    displayStatus,
  };
}

export function isProposalFullyApprovedForProject(proposal, assignment) {
  const state = getCollaborativeReviewState(proposal, assignment);
  if (state.isCollaborative) return state.dualComplete;
  return proposal?.status === 'teacher_approved';
}

export function buildCollaborativeApprovalMeta(proposal, assignment) {
  const state = getCollaborativeReviewState(proposal, assignment);
  if (!state.isCollaborative) {
    return { displayStatus: state.displayStatus };
  }

  const { frontendId, backendId } = (() => {
    const idOf = (v) => {
      if (!v) return '';
      if (typeof v === 'object' && v._id) return String(v._id);
      return String(v);
    };
    return {
      frontendId: idOf(assignment?.frontendTeacherId || assignment?.teacher),
      backendId: idOf(assignment?.backendTeacherId || assignment?.coTeacherId),
    };
  })();

  const reviews = proposal?.collaborativeTeacherReviews || { frontend: {}, backend: {} };

  return {
    displayStatus: state.displayStatus,
    collaborativeApproval: {
      frontendTeacherId: frontendId,
      backendTeacherId: backendId,
      frontendApproved: state.frontendApproved,
      backendApproved: state.backendApproved,
      dualComplete: state.dualComplete,
      awaitingDualApproval: state.awaitingDualApproval,
      frontendReview: reviews?.frontend || {},
      backendReview: reviews?.backend || {},
    },
  };
}

/** Fix proposals incorrectly marked teacher_approved before both teachers signed off. */
export async function reconcileCollaborativeProposalStatus(proposalDoc, assignment) {
  if (!assignment?.isCollaborative || !assignment?.coTeacherId || !proposalDoc?._id) {
    return proposalDoc;
  }

  const state = getCollaborativeReviewState(proposalDoc, assignment);
  const stored = proposalDoc.status;

  if (state.dualComplete && stored !== 'teacher_approved' && !TERMINAL_PROPOSAL_STATUSES.has(stored)) {
    proposalDoc.status = 'teacher_approved';
    if (typeof proposalDoc.save === 'function') await proposalDoc.save();
    return proposalDoc;
  }

  if (!state.dualComplete && stored === 'teacher_approved') {
    proposalDoc.status = 'pending_teacher_approval';
    if (typeof proposalDoc.save === 'function') await proposalDoc.save();
  }

  return proposalDoc;
}
