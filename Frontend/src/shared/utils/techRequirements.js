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

const PRIMARY_STACK_TECHS = new Set([
  'php',
  'laravel',
  'java',
  'spring boot',
  'python',
  'django',
  'react',
  'node.js',
  'flutter',
]);

const TECH_OR_GROUPS = [
  ['mysql', 'postgresql'],
  ['java', 'spring boot'],
  ['php', 'laravel'],
  ['python', 'django'],
];

function primaryStackTechs(techList) {
  return canonicalizeTechList(techList).filter((t) => PRIMARY_STACK_TECHS.has(t));
}

function requiredTechGroups(techList) {
  const required = new Set(canonicalizeTechList(techList));
  if (!required.size) return [];
  const groups = [];
  const consumed = new Set();
  for (const group of TECH_OR_GROUPS) {
    const hit = group.filter((t) => required.has(t));
    if (hit.length) {
      groups.push(hit);
      hit.forEach((t) => consumed.add(t));
    }
  }
  for (const tech of required) {
    if (!consumed.has(tech)) groups.push([tech]);
  }
  return groups;
}

function formatTechGroup(group) {
  return group.length > 1 ? group.join(' or ') : group[0];
}

/** Primary languages from subject + assignment title (PHP Final Assignment → php). */
export function inferContextPrimaryStack(assignment) {
  const fromSubject = inferRequiredTechFromSubject(assignment?.subject);
  const fromTitle = detectMentionedTechnologies(String(assignment?.title || ''));
  return primaryStackTechs([...fromSubject, ...fromTitle]);
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

/** What students must mention - teacher-stated stack first, subject/title as fallback. */
export function resolveRequiredTechnologiesForProposal(assignment, block) {
  const allowedTechnologies = toList(block?.allowedTechnologies);
  const requirementText = String(block?.requirementText || '').trim();
  const description = String(block?.description || assignment?.description || '').trim();

  let resolved = [];

  if (allowedTechnologies.length > 0) {
    resolved = canonicalizeTechList(allowedTechnologies);
  } else {
    const fromTeacherText = detectMentionedTechnologies(`${requirementText} ${description}`);
    if (fromTeacherText.length > 0) {
      resolved = fromTeacherText;
    } else {
      const fromSubject = inferRequiredTechFromSubject(assignment?.subject);
      if (fromSubject.length > 0) {
        resolved = fromSubject;
      } else {
        // Assignment title often encodes the stack (e.g. "PHP and MYSQL").
        resolved = detectMentionedTechnologies(String(assignment?.title || ''));
      }
    }
  }

  const contextPrimary = inferContextPrimaryStack(assignment);
  if (contextPrimary.length) {
    resolved = canonicalizeTechList([...resolved, ...contextPrimary]);
  }

  return resolved;
}

function proposalCoversRequiredTech(proposalText, requiredTerm) {
  const canonical = canonicalizeTechList([requiredTerm])[0] || String(requiredTerm || '').toLowerCase();
  const item = TECH_ALIASES.find((t) => t.key === canonical);
  const aliases = item ? item.aliases : [canonical];
  // Require naming the tech (or a direct alias), not merely a related family member.
  // e.g. mentioning PHP does not satisfy a MySQL requirement.
  if (aliases.some((alias) => hasAlias(proposalText, alias))) return true;
  // Laravel implies PHP stack coverage for a PHP requirement.
  if (canonical === 'php' && hasAlias(proposalText, 'laravel')) return true;
  if (canonical === 'spring boot' && hasAlias(proposalText, 'java')) return true;
  if (canonical === 'django' && hasAlias(proposalText, 'python')) return true;
  return false;
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
  let requiredStack = resolveRequiredTechnologiesForProposal(assignment, assignment);
  const contextPrimary = inferContextPrimaryStack(assignment);
  if (contextPrimary.length) {
    requiredStack = canonicalizeTechList([...requiredStack, ...contextPrimary]);
  }
  const canonicalAllowedTech = canonicalizeTechList(allowedTechnologies);
  const requiredPrimary = primaryStackTechs(
    canonicalAllowedTech.length ? canonicalAllowedTech : requiredStack
  );
  const stackForAllow = requiredPrimary.length
    ? requiredPrimary
    : canonicalAllowedTech.length
      ? canonicalAllowedTech
      : requiredStack;
  const expandedAllowed = expandTechFamily(stackForAllow);

  const proposalText = [
    payload?.title || '',
    payload?.description || '',
    ...(Array.isArray(payload?.features) ? payload.features : []),
  ]
    .join(' ')
    .toLowerCase();

  const missingKeywords = requiredKeywords.filter((k) => !proposalText.includes(k.toLowerCase()));
  const mentionedTechnologies = detectMentionedTechnologies(proposalText);
  const mentionedPrimary = primaryStackTechs(mentionedTechnologies);

  // OR-groups: MySQL or PostgreSQL counts as one requirement.
  const stackForGroups = requiredPrimary.length
    ? [...requiredPrimary, ...requiredStack.filter((t) => t === 'mysql' || t === 'postgresql' || t === 'mongodb')]
    : requiredStack.length
      ? requiredStack
      : canonicalAllowedTech;
  const missingGroups = requiredTechGroups(stackForGroups).filter(
    (g) => !g.some((t) => proposalCoversRequiredTech(proposalText, t))
  );
  const missingRequiredStack = missingGroups.map((g) => formatTechGroup(g));
  const missingAllowedTech = missingRequiredStack;
  const missingImplicitTerms = missingRequiredStack;

  // Only ban languages when a primary stack is stated (not DB-only mysql/postgres).
  const disallowedMentionedTech =
    requiredPrimary.length > 0
      ? mentionedPrimary.filter((t) => !expandedAllowed.includes(t))
      : [];

  const hasRules =
    Boolean(requirementText) ||
    requiredKeywords.length > 0 ||
    allowedTechnologies.length > 0 ||
    requiredStack.length > 0;

  const minChars = 80;
  const tooShort = proposalText.replace(/\s+/g, ' ').trim().length < minChars;

  const passed =
    !tooShort && disallowedMentionedTech.length === 0 && missingRequiredStack.length === 0;

  return {
    hasRules,
    requiredKeywords,
    allowedTechnologies,
    requirementText,
    implicitRequiredTerms: requiredStack,
    missingKeywords,
    missingAllowedTech,
    missingImplicitTerms,
    missingRequiredStack,
    disallowedMentionedTech,
    tooShort,
    advisoryOnly: false,
    passed,
  };
}
