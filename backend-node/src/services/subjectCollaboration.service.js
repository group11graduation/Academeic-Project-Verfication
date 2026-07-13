/** Classify academic subjects as frontend or backend for teacher collaboration pairing. */

export const COLLABORATION_SIDES = ['frontend', 'backend'];

const FRONTEND_HINTS = [
  'frontend',
  'front-end',
  'front end',
  'react',
  'vue',
  'angular',
  'svelte',
  'nextjs',
  'next.js',
  'html',
  'css',
  'javascript',
  'typescript',
  'ui/ux',
  'ui ',
  ' ux',
  'web design',
  'flutter',
  'mobile app',
];

const BACKEND_HINTS = [
  'backend',
  'back-end',
  'back end',
  'php',
  'node',
  'nodejs',
  'express',
  'java',
  'spring',
  'laravel',
  'django',
  'flask',
  'api',
  'database',
  'mysql',
  'mongodb',
  'postgresql',
  'server',
  '.net',
];

function haystack(subject = {}) {
  return `${subject.code || ''} ${subject.name || ''} ${subject.description || ''}`.toLowerCase();
}

/** Infer side from code/name when admin has not set collaborationSide. */
export function inferSubjectCollaborationSide(subject = {}) {
  const explicit = String(subject.collaborationSide || '').trim().toLowerCase();
  if (COLLABORATION_SIDES.includes(explicit)) return explicit;

  const text = haystack(subject);
  const fe = FRONTEND_HINTS.some((h) => text.includes(h));
  const be = BACKEND_HINTS.some((h) => text.includes(h));
  if (fe && !be) return 'frontend';
  if (be && !fe) return 'backend';
  return '';
}

export function resolveSubjectCollaborationSide(subject = {}) {
  return inferSubjectCollaborationSide(subject);
}

export function oppositeCollaborationSide(side) {
  const s = String(side || '').trim().toLowerCase();
  if (s === 'frontend') return 'backend';
  if (s === 'backend') return 'frontend';
  return '';
}

export function subjectMatchesCollaborationRole(subject, role) {
  const side = resolveSubjectCollaborationSide(subject);
  const r = String(role || '').trim().toLowerCase();
  if (!side || !r) return false;
  return side === r;
}

export function findSubjectsForRole(subjects = [], role) {
  const r = String(role || '').trim().toLowerCase();
  return (subjects || []).filter((s) => subjectMatchesCollaborationRole(s, r));
}

/** Validate only the requester's subject and role when sending a collaboration request. */
export function assertRequesterSubjectForCollaboration({ requesterSubjects = [], requesterRole, subjectId }) {
  const role = String(requesterRole || '').trim().toLowerCase();
  if (!COLLABORATION_SIDES.includes(role)) {
    const err = new Error('myRole must be frontend or backend');
    err.status = 400;
    throw err;
  }

  const sid = String(subjectId || '');
  const requesterMatch = (requesterSubjects || []).find((s) => String(s._id || s) === sid);
  if (!requesterMatch) {
    const err = new Error('You are not assigned to the selected subject in this class');
    err.status = 400;
    throw err;
  }

  const requesterSide = resolveSubjectCollaborationSide(requesterMatch);
  if (!requesterSide) {
    const err = new Error(
      `Your subject "${requesterMatch.code || requesterMatch.name}" is not classified as Frontend or Backend. Ask admin to set the subject collaboration side.`
    );
    err.status = 400;
    throw err;
  }
  if (requesterSide !== role) {
    const err = new Error(
      `You selected "${role}" but your subject "${requesterMatch.code}" is classified as ${requesterSide}. Pick the matching role or another subject.`
    );
    err.status = 400;
    throw err;
  }

  return { requesterSubject: requesterMatch, requesterSide, partnerRole: oppositeCollaborationSide(role) };
}

/**
 * Validate complementary roles and subjects when a partner accepts a collaboration request.
 */
export function assertAcceptanceSubjects({
  requesterSubjects = [],
  partnerSubjects = [],
  requesterRole,
  requesterSubjectId,
  partnerRole,
  partnerSubjectId,
}) {
  const reqRole = String(requesterRole || '').trim().toLowerCase();
  const parRole = String(partnerRole || '').trim().toLowerCase();
  if (!COLLABORATION_SIDES.includes(reqRole) || !COLLABORATION_SIDES.includes(parRole)) {
    const err = new Error('myRole must be frontend or backend');
    err.status = 400;
    throw err;
  }
  if (reqRole === parRole) {
    const err = new Error(
      `Collaboration requires one Frontend teacher and one Backend teacher — not two ${reqRole} teachers.`
    );
    err.status = 400;
    throw err;
  }
  if (oppositeCollaborationSide(reqRole) !== parRole) {
    const err = new Error(`Your role must be ${oppositeCollaborationSide(reqRole)} to match the requester's ${reqRole} role`);
    err.status = 400;
    throw err;
  }

  const requesterMatch = (requesterSubjects || []).find((s) => String(s._id || s) === String(requesterSubjectId));
  if (!requesterMatch) {
    const err = new Error('Requester subject is not valid for this class');
    err.status = 400;
    throw err;
  }
  const requesterSide = resolveSubjectCollaborationSide(requesterMatch);
  if (!requesterSide || requesterSide !== reqRole) {
    const err = new Error('Requester subject does not match their declared role');
    err.status = 400;
    throw err;
  }

  const partnerMatch = (partnerSubjects || []).find((s) => String(s._id || s) === String(partnerSubjectId));
  if (!partnerMatch) {
    const err = new Error('You are not assigned to the selected subject in this class');
    err.status = 400;
    throw err;
  }
  const partnerSide = resolveSubjectCollaborationSide(partnerMatch);
  if (!partnerSide) {
    const err = new Error(
      `Your subject "${partnerMatch.code || partnerMatch.name}" is not classified as Frontend or Backend. Ask admin to set the subject collaboration side.`
    );
    err.status = 400;
    throw err;
  }
  if (partnerSide !== parRole) {
    const err = new Error(
      `You selected "${parRole}" but your subject "${partnerMatch.code}" is classified as ${partnerSide}. Pick the matching role or another subject.`
    );
    err.status = 400;
    throw err;
  }
  if (requesterSide === partnerSide) {
    const err = new Error(
      `Collaboration requires one frontend subject and one backend subject — not two ${requesterSide} subjects.`
    );
    err.status = 400;
    throw err;
  }

  return {
    requesterSubject: requesterMatch,
    partnerSubject: partnerMatch,
    requesterSide,
    partnerSide,
  };
}

/**
 * Ensure requester's subject matches their role and target has an opposite-side subject in the class.
 */
export function assertComplementaryTeacherSubjects({
  requesterSubjects = [],
  targetSubjects = [],
  requesterRole,
  subjectId,
}) {
  const role = String(requesterRole || '').trim().toLowerCase();
  if (!COLLABORATION_SIDES.includes(role)) {
    const err = new Error('myRole must be frontend or backend');
    err.status = 400;
    throw err;
  }

  const opposite = oppositeCollaborationSide(role);
  const sid = String(subjectId || '');

  const requesterMatch = (requesterSubjects || []).find((s) => String(s._id || s) === sid);
  if (!requesterMatch) {
    const err = new Error('You are not assigned to the selected subject in this class');
    err.status = 400;
    throw err;
  }

  const requesterSide = resolveSubjectCollaborationSide(requesterMatch);
  if (!requesterSide) {
    const err = new Error(
      `Your subject "${requesterMatch.code || requesterMatch.name}" is not classified as Frontend or Backend. Ask admin to set the subject collaboration side.`
    );
    err.status = 400;
    throw err;
  }
  if (requesterSide !== role) {
    const err = new Error(
      `You selected "${role}" but your subject "${requesterMatch.code}" is classified as ${requesterSide}. Pick the matching role or another subject.`
    );
    err.status = 400;
    throw err;
  }

  const targetOpposite = (targetSubjects || []).filter((s) => {
    const side = resolveSubjectCollaborationSide(s);
    return side === opposite;
  });
  if (!targetOpposite.length) {
    const err = new Error(
      `The selected teacher has no ${opposite} subject in this class. Collaboration requires one frontend teacher and one backend teacher — not two frontend or two backend subjects.`
    );
    err.status = 400;
    throw err;
  }

  return {
    requesterSubject: requesterMatch,
    requesterSide,
    targetOppositeSubjects: targetOpposite,
    partnerRole: opposite,
  };
}
