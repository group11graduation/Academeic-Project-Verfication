/** Student-facing project pipeline status (proposal → ZIP → preview → feedback) */

function collectCollaborativeProposalComments(proposal) {
  const reviews = proposal?.collaborativeTeacherReviews;
  if (!reviews) return [];
  return ['frontend', 'backend']
    .map((role) => {
      const slot = reviews[role];
      if (!slot?.comment?.trim()) return null;
      const label = role === 'frontend' ? 'Frontend teacher (proposal)' : 'Backend teacher (proposal)';
      return `${label}: ${slot.comment.trim()}`;
    })
    .filter(Boolean);
}

export function formatTeacherScoreDisplay(score, scoreMax = 100) {
  if (score == null || Number.isNaN(Number(score))) return '';
  const max = Number(scoreMax) > 0 ? Number(scoreMax) : 100;
  return `${Number(score)}/${max}`;
}

/** All teacher feedback entries for a project (dual teachers or single). */
export function getProjectTeacherFeedbackEntries(row) {
  const sub = row?.latestProjectSubmission;
  const proposal = row?.proposal;
  const assignment = row?.assignment;
  const isCollab = Boolean(assignment?.isCollaborative && assignment?.coTeacherId);
  const entries = [];

  if (isCollab && sub?.collaborativeProjectReviews) {
    const roleLabels = { frontend: 'Frontend teacher', backend: 'Backend teacher' };
    for (const role of ['frontend', 'backend']) {
      const slot = sub.collaborativeProjectReviews[role];
      if (!slot) continue;
      const comment = String(slot.comment || '').trim();
      const score = slot.score ?? null;
      const scoreMax = slot.scoreMax ?? 100;
      if (!comment && score == null) continue;
      entries.push({
        role,
        roleLabel: roleLabels[role],
        comment,
        score,
        scoreMax,
        scoreDisplay: formatTeacherScoreDisplay(score, scoreMax),
        reviewedAt: slot.reviewedAt || null,
      });
    }
    if (entries.length) return entries;
  }

  const commentParts = [
    sub?.teacherComment,
    ...(sub ? [] : [proposal?.teacherComment]),
    ...collectCollaborativeProposalComments(proposal),
  ]
    .filter((c) => c && String(c).trim())
    .map((c) => String(c).trim());
  const uniqueComments = [...new Set(commentParts)];
  const comment = uniqueComments.join('\n\n');

  const score = sub?.teacherScore ?? proposal?.teacherProposalScore ?? null;
  const scoreMax = sub?.teacherScoreMax ?? proposal?.teacherProposalScoreMax ?? 100;

  if (comment || score != null) {
    entries.push({
      role: 'primary',
      roleLabel: 'Teacher',
      comment,
      score,
      scoreMax,
      scoreDisplay: formatTeacherScoreDisplay(score, scoreMax),
      reviewedAt: sub?.teacherReviewedAt || null,
    });
  }

  return entries;
}

/** @deprecated use getProjectTeacherFeedbackEntries — first/merged entry for simple badges */
export function getProjectTeacherFeedback(row) {
  const entries = getProjectTeacherFeedbackEntries(row);
  if (!entries.length) return null;
  if (entries.length === 1) return entries[0];
  return {
    role: 'combined',
    roleLabel: 'Teachers',
    comment: entries.map((e) => (e.comment ? `${e.roleLabel}: ${e.comment}` : '')).filter(Boolean).join('\n\n'),
    score: null,
    scoreMax: null,
    scoreDisplay: entries
      .filter((e) => e.scoreDisplay)
      .map((e) => `${e.roleLabel}: ${e.scoreDisplay}`)
      .join(' · '),
    reviewedAt: entries[0]?.reviewedAt || null,
    entries,
  };
}

export function getProjectWorkflowStatus(row) {
  const sub = row?.latestProjectSubmission;
  const proposalStatus = row?.proposal?.status || 'not_submitted';
  const entries = getProjectTeacherFeedbackEntries(row);
  const hasFeedback = entries.length > 0;

  if (hasFeedback) {
    const first = entries[0];
    return {
      stage: 'feedback',
      label: entries.length > 1 ? 'Feedback received (2 teachers)' : 'Feedback received',
      tone: 'violet',
      description:
        first.comment ||
        entries.map((e) => e.scoreDisplay).filter(Boolean).join(' · ') ||
        '',
    };
  }
  if (sub?.teacherPreviewedAt) {
    return {
      stage: 'previewed',
      label: 'Teacher previewed',
      tone: 'sky',
      description: 'Your teacher opened a live preview of your project.',
    };
  }
  if (sub) {
    return {
      stage: 'submitted',
      label: 'Project submitted',
      tone: 'emerald',
      description: 'Your project ZIP is with your teacher for review.',
    };
  }
  if (proposalStatus === 'teacher_approved') {
    return {
      stage: 'ready',
      label: 'Ready to submit',
      tone: 'blue',
      description: 'Proposal approved — upload your project ZIP.',
    };
  }
  if (
    proposalStatus === 'pending_teacher_approval' ||
    proposalStatus === 'submitted' ||
    proposalStatus === 'pending'
  ) {
    return {
      stage: 'proposal_pending',
      label: 'Proposal in review',
      tone: 'amber',
      description: 'Waiting for teacher approval on your proposal.',
    };
  }
  if (proposalStatus === 'teacher_rejected' || proposalStatus === 'requirements_rejected') {
    return {
      stage: 'proposal_rejected',
      label: 'Proposal declined',
      tone: 'rose',
      description: 'Update your proposal and resubmit.',
    };
  }
  if (proposalStatus === 'revision_required') {
    return {
      stage: 'proposal_revision',
      label: 'Revision required',
      tone: 'amber',
      description: 'Your teacher asked for proposal changes.',
    };
  }
  return {
    stage: 'proposal_needed',
    label: 'Proposal needed',
    tone: 'slate',
    description: 'Submit a proposal before uploading your project.',
  };
}

const TONE_CLASSES = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  blue: 'border-blue-200 bg-blue-50 text-blue-800',
  sky: 'border-sky-200 bg-sky-50 text-sky-800',
  violet: 'border-violet-200 bg-violet-50 text-violet-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  rose: 'border-rose-200 bg-rose-50 text-rose-800',
  slate: 'border-slate-200 bg-slate-100 text-slate-700',
};

export function getWorkflowBadgeClasses(tone) {
  return TONE_CLASSES[tone] || TONE_CLASSES.slate;
}

export function formatWorkflowDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch {
    return '—';
  }
}
