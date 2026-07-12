import { formatSimilarityPercent } from './proposalSimilarityUi';

const OUTCOME_LABELS = {
  requirements_rejected: 'Rejected — requirements not met',
  ai_rejected_same_semester: 'Rejected — high same-semester similarity',
  ai_flagged_previous_semester: 'Flagged — legacy similarity warning',
  pending_teacher_approval: 'Passed checks — waiting for teacher',
  teacher_approved: 'Approved by teacher',
  teacher_rejected: 'Rejected by teacher',
  revision_required: 'Revision requested',
  submitted: 'Submitted',
  draft: 'Draft saved',
};

function formatWhen(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

function issueLabelsFromEntry(entry) {
  if (!entry || entry.requirementCheckPassed !== false) return [];
  const labels = [];
  for (const term of entry.requirementMissingImplicitTerms || []) {
    labels.push(`Missing from teacher text: ${term}`);
  }
  for (const term of entry.requirementMissingAllowedTech || []) {
    labels.push(`Missing required technology: ${term}`);
  }
  for (const term of entry.requirementMissingKeywords || []) {
    labels.push(`Missing keyword: ${term}`);
  }
  for (const term of entry.requirementDisallowedTech || []) {
    labels.push(`Disallowed technology: ${term}`);
  }
  if (!labels.length && entry.requirementCheckSummary) {
    labels.push(entry.requirementCheckSummary);
  }
  return labels;
}

export function getProposalSubmissionHistoryContext(proposal) {
  const summary = proposal?.submissionHistorySummary || {};
  const history = Array.isArray(summary.history)
    ? summary.history
    : Array.isArray(proposal?.submissionHistory)
      ? proposal.submissionHistory
      : [];

  const attemptCount = summary.attemptCount || history.length || 0;
  const latest = summary.latest || history[history.length - 1] || null;
  const hadRequirementFailure = Boolean(summary.hadRequirementFailure);
  const latestRequirementPassed = summary.latestRequirementPassed !== false;
  const resolvedAfterFailure = Boolean(summary.resolvedAfterFailure);
  const latestIssues = summary.latestIssues?.length
    ? summary.latestIssues
    : issueLabelsFromEntry(latest);
  const lastResolved = summary.lastResolved || latest?.resolvedRequirementIssues || [];
  const firstRequirementFailure = summary.firstRequirementFailure || null;

  return {
    history,
    attemptCount,
    latest,
    hadRequirementFailure,
    latestRequirementPassed,
    resolvedAfterFailure,
    latestIssues,
    lastResolved,
    firstRequirementFailure,
    firstFailureIssues: issueLabelsFromEntry(firstRequirementFailure),
  };
}

export function formatSubmissionHistoryEntry(entry, index) {
  const outcome = String(entry?.outcome || '');
  const requirementFailed = entry?.requirementCheckPassed === false;
  const issues = issueLabelsFromEntry(entry);
  const samePct =
    entry?.aiSameSemesterMaxScore != null
      ? formatSimilarityPercent(entry.aiSameSemesterMaxScore)
      : null;
  const legacyPct =
    entry?.aiPreviousSemesterMaxScore != null
      ? formatSimilarityPercent(entry.aiPreviousSemesterMaxScore)
      : null;

  let headline = OUTCOME_LABELS[outcome] || outcome.replace(/_/g, ' ') || `Attempt ${index + 1}`;
  let tone = 'neutral';

  if (requirementFailed) {
    tone = 'error';
  } else if (outcome === 'pending_teacher_approval') {
    tone = entry?.resolvedRequirementIssues?.length ? 'success' : 'info';
    if (entry?.resolvedRequirementIssues?.length) {
      headline = 'Requirements fixed — sent to teacher';
    }
  } else if (outcome === 'ai_rejected_same_semester') {
    tone = 'error';
  } else if (outcome === 'ai_flagged_previous_semester') {
    tone = 'warn';
  } else if (outcome === 'teacher_approved') {
    tone = 'success';
  }

  const detailParts = [];
  if (issues.length) {
    detailParts.push(issues.join(' · '));
  } else if (entry?.requirementCheckPassed !== false && outcome !== 'requirements_rejected') {
    detailParts.push('Assignment requirements satisfied.');
  }
  if (entry?.resolvedRequirementIssues?.length) {
    detailParts.push(`Resolved: ${entry.resolvedRequirementIssues.join(', ')}`);
  }
  if (samePct && outcome !== 'requirements_rejected') {
    detailParts.push(`Same-semester overlap ${samePct} (advisory)`);
  }
  if (legacyPct && Number(entry?.aiPreviousSemesterMaxScore) > 0) {
    detailParts.push(`Legacy overlap ${legacyPct}`);
  }

  return {
    key: `${entry?.attemptedAt || index}-${outcome}`,
    attemptLabel: `Attempt ${index + 1}`,
    when: formatWhen(entry?.attemptedAt),
    headline,
    tone,
    detail: detailParts.join(' '),
    issues,
    resolved: entry?.resolvedRequirementIssues || [],
  };
}

export function getTeacherSubmissionJourneyHeadline(ctx, proposalStatus) {
  const status = String(proposalStatus || '');
  if (ctx.resolvedAfterFailure) {
    return {
      title: 'Requirements fixed',
      subtitle: 'Student updated the proposal and it now passes the assignment rules.',
      tone: 'success',
    };
  }
  if (!ctx.latestRequirementPassed || status === 'requirements_rejected') {
    return {
      title: 'Requirements not met',
      subtitle: ctx.latestIssues[0] || 'The proposal still does not match assignment rules.',
      tone: 'error',
    };
  }
  if (status === 'ai_rejected_same_semester') {
    return {
      title: 'Blocked for similarity',
      subtitle: 'Same-semester overlap was too high. Student must revise and resubmit.',
      tone: 'error',
    };
  }
  if (status === 'pending_teacher_approval') {
    return {
      title: ctx.hadRequirementFailure ? 'Ready for your review' : 'Ready for your review',
      subtitle: ctx.hadRequirementFailure
        ? 'Earlier requirement issues were addressed. AI similarity is advisory only.'
        : 'Requirements passed. Review the proposal on its merits.',
      tone: 'info',
    };
  }
  return {
    title: 'Submission recorded',
    subtitle: 'See attempt history for requirement and AI checks.',
    tone: 'neutral',
  };
}
