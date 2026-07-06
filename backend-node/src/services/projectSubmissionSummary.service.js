/** Client-safe summary of a project ZIP submission for student/teacher APIs */

const projectReviewSlotSchema = {
  teacherId: null,
  comment: '',
  score: null,
  scoreMax: 100,
  reviewedAt: null,
};

function normalizeReviewSlot(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const comment = String(raw.comment || '').trim();
  const score = raw.score ?? raw.teacherScore ?? null;
  const scoreMax = raw.scoreMax ?? raw.teacherScoreMax ?? 100;
  if (!comment && score == null) return null;
  return {
    teacherId: raw.teacherId || null,
    comment,
    score: score != null ? Number(score) : null,
    scoreMax: Number(scoreMax) > 0 ? Number(scoreMax) : 100,
    reviewedAt: raw.reviewedAt || null,
  };
}

function normalizeCollaborativeProjectReviews(doc) {
  const raw = doc?.collaborativeProjectReviews || {};
  const out = { frontend: null, backend: null };
  out.frontend = normalizeReviewSlot(raw.frontend);
  out.backend = normalizeReviewSlot(raw.backend);
  return out;
}

export function formatTeacherScoreDisplay(score, scoreMax = 100) {
  if (score == null || Number.isNaN(Number(score))) return '';
  const max = Number(scoreMax) > 0 ? Number(scoreMax) : 100;
  return `${Number(score)}/${max}`;
}

export function toProjectSubmissionClient(doc) {
  if (!doc) return null;
  const rel = String(doc.storedRelativePath || '').replace(/^\/+/, '');
  const scoreMax = doc.teacherScoreMax ?? 100;
  return {
    _id: doc._id,
    originalFilename: doc.originalFilename || '',
    sizeBytes: doc.sizeBytes ?? 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    version: doc.version ?? 1,
    downloadPath: rel ? `/uploads/${rel}` : '',
    teacherComment: doc.teacherComment || '',
    teacherScore: doc.teacherScore ?? null,
    teacherScoreMax: scoreMax,
    teacherReviewedAt: doc.teacherReviewedAt || null,
    teacherPreviewedAt: doc.teacherPreviewedAt || null,
    collaborativeProjectReviews: normalizeCollaborativeProjectReviews(doc),
  };
}

function parseScoreFields(body) {
  const rawScore = body?.teacherProposalScore;
  const rawMax = body?.teacherProposalScoreMax;
  let score = null;
  let scoreMax = 100;

  if (rawMax !== undefined && rawMax !== null && rawMax !== '') {
    const m = Number(rawMax);
    if (!Number.isNaN(m) && m > 0) scoreMax = m;
  }

  if (rawScore !== undefined && rawScore !== null && rawScore !== '') {
    const n = Number(rawScore);
    if (!Number.isNaN(n) && n >= 0 && n <= scoreMax) score = n;
  }

  return { score, scoreMax };
}

export function applyProjectTeacherEvalFields(submission, body) {
  const { comment } = body || {};
  const trimmedComment = comment == null ? '' : String(comment).trim();

  if (trimmedComment) {
    submission.teacherComment = trimmedComment;
    submission.teacherReviewedAt = new Date();
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, 'teacherProposalScore') ||
      Object.prototype.hasOwnProperty.call(body || {}, 'teacherProposalScoreMax')) {
    const { score, scoreMax } = parseScoreFields(body);
    if (Object.prototype.hasOwnProperty.call(body || {}, 'teacherProposalScore')) {
      submission.teacherScore = score;
    }
    if (Object.prototype.hasOwnProperty.call(body || {}, 'teacherProposalScoreMax')) {
      submission.teacherScoreMax = scoreMax;
    }
    if (score != null || trimmedComment) {
      submission.teacherReviewedAt = new Date();
    }
  }
}

export function ensureCollaborativeProjectReviews(submission) {
  if (!submission.collaborativeProjectReviews) {
    submission.collaborativeProjectReviews = {
      frontend: { ...projectReviewSlotSchema },
      backend: { ...projectReviewSlotSchema },
    };
  }
  if (!submission.collaborativeProjectReviews.frontend) {
    submission.collaborativeProjectReviews.frontend = { ...projectReviewSlotSchema };
  }
  if (!submission.collaborativeProjectReviews.backend) {
    submission.collaborativeProjectReviews.backend = { ...projectReviewSlotSchema };
  }
}

export function applyCollaborativeProjectReviewSlot(submission, role, teacherId, body) {
  ensureCollaborativeProjectReviews(submission);
  const slot = submission.collaborativeProjectReviews[role];
  slot.teacherId = teacherId;
  slot.reviewedAt = new Date();

  const trimmedComment = body?.comment == null ? '' : String(body.comment).trim();
  if (trimmedComment) slot.comment = trimmedComment;

  if (
    Object.prototype.hasOwnProperty.call(body || {}, 'teacherProposalScore') ||
    Object.prototype.hasOwnProperty.call(body || {}, 'teacherProposalScoreMax')
  ) {
    const { score, scoreMax } = parseScoreFields(body);
    if (Object.prototype.hasOwnProperty.call(body || {}, 'teacherProposalScore')) {
      slot.score = score;
    }
    if (Object.prototype.hasOwnProperty.call(body || {}, 'teacherProposalScoreMax')) {
      slot.scoreMax = scoreMax;
    }
  }
}

/** Build student-facing feedback entries from a submission row */
export function buildProjectFeedbackEntries(submission, proposal, assignment) {
  const entries = [];
  const isCollab = Boolean(assignment?.isCollaborative && assignment?.coTeacherId);
  const client = typeof submission === 'object' && submission?.collaborativeProjectReviews != null
    ? submission
    : toProjectSubmissionClient(submission);

  if (!client) {
    return entries;
  }

  if (isCollab && client.collaborativeProjectReviews) {
    const roleLabels = { frontend: 'Frontend teacher', backend: 'Backend teacher' };
    for (const role of ['frontend', 'backend']) {
      const slot = client.collaborativeProjectReviews[role];
      if (!slot) continue;
      if (!slot.comment && slot.score == null) continue;
      entries.push({
        role,
        roleLabel: roleLabels[role],
        comment: slot.comment || '',
        score: slot.score ?? null,
        scoreMax: slot.scoreMax ?? 100,
        scoreDisplay: formatTeacherScoreDisplay(slot.score, slot.scoreMax),
        reviewedAt: slot.reviewedAt || null,
      });
    }
    if (entries.length) return entries;
  }

  const commentParts = [client.teacherComment, proposal?.teacherComment]
    .filter((c) => c && String(c).trim())
    .map((c) => String(c).trim());
  const uniqueComments = [...new Set(commentParts)];
  const comment = uniqueComments.join('\n\n');
  const score = client.teacherScore ?? proposal?.teacherProposalScore ?? null;
  const scoreMax = client.teacherScoreMax ?? proposal?.teacherProposalScoreMax ?? 100;

  if (comment || score != null) {
    entries.push({
      role: 'primary',
      roleLabel: 'Teacher',
      comment,
      score,
      scoreMax,
      scoreDisplay: formatTeacherScoreDisplay(score, scoreMax),
      reviewedAt: client.teacherReviewedAt || null,
    });
  }

  return entries;
}
