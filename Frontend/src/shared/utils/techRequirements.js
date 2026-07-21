const TECH_ALIASES = [
  { key: 'php', aliases: ['php'] },
  { key: 'mysql', aliases: ['mysql', 'my sql'] },
  { key: 'postgresql', aliases: ['postgresql', 'postgres', 'postgre sql'] },
  { key: 'mongodb', aliases: ['mongodb', 'mongo db'] },
  { key: 'node.js', aliases: ['node.js', 'nodejs', 'node js'] },
  { key: 'react', aliases: ['react', 'reactjs', 'react.js', 'vite'] },
  { key: 'flutter', aliases: ['flutter'] },
  { key: 'java', aliases: ['java'] },
  { key: 'python', aliases: ['python'] },
  { key: 'laravel', aliases: ['laravel'] },
  { key: 'spring boot', aliases: ['spring boot'] },
  { key: 'django', aliases: ['django'] },
];

const TECH_COMPATIBILITY = {
  php: ['php', 'mysql', 'laravel'],
  mysql: ['php', 'mysql', 'laravel'],
  laravel: ['php', 'mysql', 'laravel'],
  java: ['java', 'spring boot'],
  'spring boot': ['java', 'spring boot'],
  python: ['python', 'django'],
  django: ['python', 'django'],
  react: ['react', 'node.js'],
  'node.js': ['node.js', 'react'],
  flutter: ['flutter'],
  postgresql: ['postgresql'],
  mongodb: ['mongodb'],
};

function toList(value) {
  if (Array.isArray(value)) return value.map((x) => String(x || '').trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasAlias(text, alias) {
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(alias.toLowerCase())}([^a-z0-9]|$)`, 'i');
  return pattern.test(String(text || ''));
}

export function canonicalizeTechList(techList) {
  const canonical = [];
  for (const raw of techList) {
    const term = String(raw || '').trim().toLowerCase();
    if (!term) continue;
    const mapped = TECH_ALIASES.find((t) => t.key === term || t.aliases.some((a) => a === term));
    canonical.push(mapped ? mapped.key : term);
  }
  return [...new Set(canonical)];
}

export function detectMentionedTechnologies(text) {
  const mentioned = [];
  const src = String(text || '').toLowerCase();
  for (const item of TECH_ALIASES) {
    if (item.aliases.some((alias) => hasAlias(src, alias))) {
      mentioned.push(item.key);
    }
  }
  return [...new Set(mentioned)];
}

export function inferRequiredTechFromSubject(subject) {
  if (!subject || typeof subject !== 'object') return [];

  const subjectName = String(subject?.name || '').toLowerCase();
  const subjectCode = String(subject?.code || '').toLowerCase();
  const blob = `${subjectName} ${subjectCode}`;
  const required = [];

  if (/\bphp\b/.test(blob)) required.push('php');
  if (/\bmysql\b/.test(blob) || (/\bsql\b/.test(blob) && /\bphp\b/.test(blob))) required.push('mysql');
  if (/\bjava\b/.test(blob)) required.push('java');
  if (/\bspring\b/.test(blob)) required.push('spring boot');
  if (/\bpython\b/.test(blob)) required.push('python');
  if (/\bflutter\b/.test(blob)) required.push('flutter');
  if (/\bnode\.?js\b|\bnodejs\b/.test(blob)) required.push('node.js');
  if (/\breact\b/.test(blob) && !/\bphp\b/.test(blob)) required.push('react');

  return [...new Set(required)];
}

function expandTechFamily(techList) {
  const expanded = new Set();
  for (const tech of canonicalizeTechList(techList)) {
    expanded.add(tech);
    const family = TECH_COMPATIBILITY[tech];
    if (family) {
      for (const related of family) expanded.add(related);
    }
  }
  return [...expanded];
}

export function techFamiliesOverlap(left, right) {
  const expandedLeft = expandTechFamily(left);
  const expandedRight = expandTechFamily(right);
  return expandedLeft.some((tech) => expandedRight.includes(tech));
}

function formatTechList(list) {
  return canonicalizeTechList(list).join(', ');
}

/** What students must mention — teacher-stated stack first, subject only as fallback. */
export function resolveRequiredTechnologiesForProposal(assignment, block) {
  const allowedTechnologies = toList(block?.allowedTechnologies);
  const requirementText = String(block?.requirementText || '').trim();
  const description = String(block?.description || assignment?.description || '').trim();

  if (allowedTechnologies.length > 0) {
    return canonicalizeTechList(allowedTechnologies);
  }

  const fromTeacherText = detectMentionedTechnologies(`${requirementText} ${description}`);
  if (fromTeacherText.length > 0) {
    return fromTeacherText;
  }

  return inferRequiredTechFromSubject(assignment?.subject);
}

export function validateAssignmentTechnologyConsistency({
  subject,
  title = '',
  description = '',
  requirementText = '',
  allowedTechnologies,
  allowedTechnologiesText,
  isCollaborative = false,
} = {}) {
  if (isCollaborative) return { ok: true };

  const subjectTech = inferRequiredTechFromSubject(subject);
  const allowed = canonicalizeTechList(toList(allowedTechnologies ?? allowedTechnologiesText));
  const textTech = detectMentionedTechnologies(`${title} ${description} ${requirementText}`);
  const statedTech = [...new Set([...allowed, ...textTech])];

  if (subjectTech.length > 0 && statedTech.length > 0 && !techFamiliesOverlap(subjectTech, statedTech)) {
    const subjectLabel = subject?.code || subject?.name || 'course subject';
    return {
      ok: false,
      message: `Technologies do not match the course subject (${subjectLabel}: ${formatTechList(subjectTech)}). The assignment mentions ${formatTechList(statedTech)} in the description, requirements, or allowed technologies. Choose a matching subject or update the assignment to use the same stack.`,
      subjectTech,
      statedTech,
    };
  }

  if (allowed.length > 0 && textTech.length > 0 && !techFamiliesOverlap(allowed, textTech)) {
    return {
      ok: false,
      message: `Allowed technologies (${formatTechList(allowed)}) conflict with technologies mentioned in the description or requirement text (${formatTechList(textTech)}).`,
      allowedTech: allowed,
      textTech,
    };
  }

  return { ok: true };
}

export function evaluateProposalRequirementCoverage(assignment, payload) {
  const requiredKeywords = toList(assignment?.requiredKeywords);
  const allowedTechnologies = toList(assignment?.allowedTechnologies);
  const requirementText = String(assignment?.requirementText || '').trim();
  const implicitRequiredTerms = resolveRequiredTechnologiesForProposal(assignment, assignment);
  const canonicalAllowedTech = canonicalizeTechList(allowedTechnologies);
  const expandedAllowed = expandTechFamily(canonicalAllowedTech);

  const proposalText = [
    payload?.title || '',
    payload?.description || '',
    ...(Array.isArray(payload?.features) ? payload.features : []),
  ]
    .join(' ')
    .toLowerCase();

  const missingKeywords = requiredKeywords.filter((k) => !proposalText.includes(k.toLowerCase()));
  const missingAllowedTech = allowedTechnologies.filter((t) => !proposalText.includes(t.toLowerCase()));
  const missingImplicitTerms = implicitRequiredTerms.filter((t) => !proposalText.includes(t.toLowerCase()));
  const mentionedTechnologies = detectMentionedTechnologies(proposalText);
  const disallowedMentionedTech =
    allowedTechnologies.length > 0
      ? mentionedTechnologies.filter((t) => !expandedAllowed.includes(t))
      : [];
  const hasRules =
    Boolean(requirementText) ||
    requiredKeywords.length > 0 ||
    allowedTechnologies.length > 0 ||
    implicitRequiredTerms.length > 0;

  const minChars = 80;
  const tooShort = proposalText.replace(/\s+/g, ' ').trim().length < minChars;

  // Client gate: block empty/chatty shells and wrong stack only.
  // Meaning match (paraphrase vs teacher requirements) is decided by MiniLM on the server.
  return {
    hasRules,
    requiredKeywords,
    allowedTechnologies,
    requirementText,
    implicitRequiredTerms,
    missingKeywords,
    missingAllowedTech,
    missingImplicitTerms,
    disallowedMentionedTech,
    tooShort,
    advisoryOnly: missingKeywords.length > 0 || missingAllowedTech.length > 0 || missingImplicitTerms.length > 0,
    passed: !tooShort && disallowedMentionedTech.length === 0,
  };
}
