/** Mirrors Python defaults: AI_SAME_SEMESTER_REJECT=0.72, AI_PREVIOUS_SEMESTER_WARN=0.58 */
const SAME_SEMESTER_REJECT = 0.72;
const PREVIOUS_SEMESTER_WARN = 0.58;

export function formatSimilarityPercent(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n * 100)}%`;
}

/**
 * Teacher-facing AI similarity context. Status is authoritative: if the student reached
 * pending_teacher_approval, they were NOT auto-rejected for same-semester overlap.
 */
export function getProposalAiSimilarityContext(proposal) {
  const status = String(proposal?.displayStatus || proposal?.status || '');
  const sameScore = Number(proposal?.aiSameSemesterMaxScore);
  const legacyScore = Number(proposal?.aiPreviousSemesterMaxScore);
  const samePct = formatSimilarityPercent(sameScore);
  const legacyPct = formatSimilarityPercent(legacyScore);
  const sameNum = Number.isFinite(sameScore) ? sameScore : null;
  const legacyNum = Number.isFinite(legacyScore) ? legacyScore : null;

  if (status === 'ai_rejected_same_semester') {
    return {
      level: 'reject',
      samePct,
      legacyPct,
      headline: 'AI blocked — high same-semester overlap',
      detail: `Overlap ${samePct} met or exceeded the auto-reject threshold (${Math.round(SAME_SEMESTER_REJECT * 100)}%). The student must revise before resubmitting.`,
      studentBlocked: true,
    };
  }

  if (status === 'ai_flagged_previous_semester') {
    return {
      level: 'warn',
      samePct,
      legacyPct,
      headline: 'Legacy / previous-term similarity warning',
      detail: `This idea resembles an older approved project (legacy overlap ${legacyPct}). The student may proceed, but review originality.`,
      studentBlocked: false,
    };
  }

  const highSameButCleared =
    sameNum != null && sameNum >= SAME_SEMESTER_REJECT && status === 'pending_teacher_approval';

  return {
    level: 'ok',
    samePct,
    legacyPct,
    headline: highSameButCleared
      ? 'Pending your review'
      : 'AI cleared — unique enough to review',
    detail:
      sameNum != null
        ? `Same-semester overlap ${samePct} is advisory only (auto-reject starts at ${Math.round(SAME_SEMESTER_REJECT * 100)}%). The student was not blocked for similarity — review the proposal on its merits.`
        : 'No same-semester similarity score on file. Review the proposal on its merits.',
    studentBlocked: false,
    legacyNote:
      legacyNum != null && legacyNum >= PREVIOUS_SEMESTER_WARN
        ? `Legacy overlap ${legacyPct} is elevated but did not block submission.`
        : null,
  };
}
