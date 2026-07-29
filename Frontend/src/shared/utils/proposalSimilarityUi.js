/** Mirrors Python defaults: AI_SAME_SEMESTER_REJECT=0.55, AI_PREVIOUS_SEMESTER_WARN=0.50 */
const SAME_SEMESTER_REJECT = 0.55;
const PREVIOUS_SEMESTER_WARN = 0.5;

export function formatSimilarityPercent(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return '-';
  return `${Math.round(n * 100)}%`;
}

/**
 * Teacher-facing AI similarity context.
 * Rules:
 * - Same semester ≥ 55% → auto-reject (student blocked)
 * - Previous / legacy semester ≥ 50% → recommendation only (student can proceed)
 * - Below those thresholds → clear for teacher review
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
      headline: 'Rejected - same-semester overlap',
      detail: `Same-semester similarity ${samePct} met or exceeded the auto-reject threshold (${Math.round(SAME_SEMESTER_REJECT * 100)}%). The student must revise and resubmit.`,
      studentBlocked: true,
    };
  }

  if (status === 'ai_flagged_previous_semester') {
    return {
      level: 'warn',
      samePct,
      legacyPct,
      headline: 'Recommendation - previous-semester / legacy overlap',
      detail: `This idea resembles a project from a previous semester (overlap ${legacyPct}). The student was not blocked; review originality and the suggested new features.`,
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
      : 'Cleared - unique enough for review',
    detail:
      sameNum != null
        ? `Same-semester overlap ${samePct} is below the ${Math.round(SAME_SEMESTER_REJECT * 100)}% auto-reject line. Previous-semester overlaps only produce recommendations (from ${Math.round(PREVIOUS_SEMESTER_WARN * 100)}%), not rejection.`
        : 'No same-semester similarity score on file. Review the proposal on its merits.',
    studentBlocked: false,
    legacyNote:
      legacyNum != null && legacyNum >= PREVIOUS_SEMESTER_WARN
        ? `Previous-semester / legacy overlap ${legacyPct} is elevated (recommendation only - not blocked).`
        : null,
  };
}
