/**
 * Turn raw API / pipeline / Mongoose-style reject text into short student-facing copy.
 */

const VERDICT_LABELS = {
  match: 'looks aligned',
  mismatch: 'does not match',
  skipped: 'could not be checked',
  unavailable: 'temporarily unavailable',
  consistent: 'consistent',
  needs_review: 'needs teacher review',
  reject: 'rejected',
};

const PIPELINE_STATUS_LABELS = {
  accepted: 'Accepted',
  failed_extraction: 'ZIP could not be opened',
  tech_audit_rejected: 'Project structure check failed',
  tech_mismatch_rejected: 'Technology does not match your approved proposal',
};

/** Map snake_case / enum tokens to plain English. */
export function humanizeVerdict(value) {
  const key = String(value || '')
    .trim()
    .toLowerCase();
  if (!key) return '';
  if (VERDICT_LABELS[key]) return VERDICT_LABELS[key];
  return key.replace(/_/g, ' ');
}

export function humanizePipelineStatus(status) {
  const key = String(status || '')
    .trim()
    .toLowerCase();
  return PIPELINE_STATUS_LABELS[key] || humanizeVerdict(key);
}

/**
 * Soften Mongoose / Express validation noise into one readable sentence.
 */
export function humanizeModelOrServerError(raw, fallback = '') {
  const text = String(raw || '').trim();
  if (!text) return fallback || '';

  // Mongoose: "ProjectSubmission validation failed: storedRelativePath: Path `storedRelativePath` is required."
  const mongoose = text.match(/validation failed:\s*(.+)$/i);
  if (mongoose) {
    const detail = mongoose[1]
      .split(',')
      .map((part) => {
        const m = part.match(/Path `([^`]+)`\s*(.+)$/i) || part.match(/(\w+):\s*(.+)$/);
        if (!m) return part.trim();
        const field = String(m[1] || '')
          .replace(/([A-Z])/g, ' $1')
          .replace(/_/g, ' ')
          .trim()
          .toLowerCase();
        let msg = String(m[2] || '')
          .replace(/^Path `[^`]+`\s*/i, '')
          .replace(/\.$/, '')
          .trim();
        if (/is required/i.test(msg)) return `Please provide a valid ${field}.`;
        if (/Cast to|ObjectId/i.test(msg)) return `The ${field} value is invalid.`;
        return `${field}: ${msg}.`;
      })
      .filter(Boolean);
    if (detail.length) return detail.join(' ');
  }

  if (/Cast to ObjectId failed/i.test(text)) {
    return 'One of the IDs in this request is invalid. Refresh the page and try again.';
  }
  if (/E11000 duplicate key/i.test(text)) {
    return 'This record already exists. Refresh and try again, or contact your teacher.';
  }
  if (/Consistency check unavailable/i.test(text)) {
    return 'We could not verify your project right now. Please wait a moment and try uploading again.';
  }
  if (/exact copy of a project already submitted/i.test(text)) {
    return 'This ZIP is an exact copy of another student\'s project. Upload your own work.';
  }
  if (/looks like a previous student's work|looks like a previous student/i.test(text)) {
    return text;
  }
  if (/does not match your approved proposal description/i.test(text)) {
    return text;
  }
  if (/already has an accepted project submission/i.test(text)) {
    return 'This proposal already has an accepted project ZIP. Contact your teacher if you need to resubmit.';
  }

  // Drop leading technical prefixes
  return text
    .replace(/^Error:\s*/i, '')
    .replace(/^ValidationError:\s*/i, '')
    .replace(/^MongoServerError:\s*/i, '')
    .trim();
}

/**
 * Build a plain-language summary of consistencyCheck for dialogs / banners.
 */
export function formatConsistencyCheckHuman(cc) {
  if (!cc || typeof cc !== 'object') return '';
  const lines = [];

  const tech = humanizeVerdict(cc.tech_verdict);
  const desc = humanizeVerdict(cc.description_verdict);
  const overall = humanizeVerdict(cc.overall_verdict);

  if (cc.tech_verdict === 'mismatch') {
    lines.push(
      'Technology check: your ZIP dependencies do not line up with the technologies approved for this proposal.'
    );
  } else if (tech) {
    lines.push(`Technology check: ${tech}.`);
  }

  if (cc.description_verdict === 'mismatch') {
    lines.push(
      'Description check: the project README/code does not match what you proposed to build. Same technology is not enough.'
    );
  } else if (desc && cc.description_verdict !== 'skipped') {
    lines.push(`Description check: ${desc}.`);
  }

  if (overall === 'rejected' || cc.overall_verdict === 'reject') {
    lines.push('Result: upload was not accepted. Fix the issues above and try again.');
  } else if (cc.overall_verdict === 'needs_review' || cc.needs_review) {
    lines.push('Result: flagged for teacher review.');
  } else if (cc.overall_verdict === 'consistent') {
    lines.push('Result: consistency checks passed.');
  }

  if (typeof cc.tech_match_score === 'number') {
    lines.push(`Technology match score: ${Math.round(cc.tech_match_score * 100)}%.`);
  }
  if (typeof cc.description_match_score === 'number' && cc.description_verdict !== 'skipped') {
    lines.push(`Description match score: ${Math.round(cc.description_match_score * 100)}%.`);
  }

  return lines.join('\n');
}
