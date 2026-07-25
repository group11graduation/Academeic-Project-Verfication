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

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasAlias(text, alias) {
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(alias.toLowerCase())}([^a-z0-9]|$)`, 'i');
  return pattern.test(String(text || ''));
}

function canonicalizeTechList(techList) {
  const canonical = [];
  for (const raw of techList) {
    const term = String(raw || '').trim().toLowerCase();
    if (!term) continue;
    const mapped = TECH_ALIASES.find((t) => t.key === term || t.aliases.some((a) => a === term));
    canonical.push(mapped ? mapped.key : term);
  }
  return [...new Set(canonical)];
}

function detectMentionedTechnologies(text) {
  const mentioned = [];
  const src = String(text || '').toLowerCase();
  for (const item of TECH_ALIASES) {
    if (item.aliases.some((alias) => hasAlias(src, alias))) {
      mentioned.push(item.key);
    }
  }
  return [...new Set(mentioned)];
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

function techFamiliesOverlap(left, right) {
  const expandedLeft = expandTechFamily(left);
  const expandedRight = expandTechFamily(right);
  return expandedLeft.some((tech) => expandedRight.includes(tech));
}

function formatTechList(list) {
  return canonicalizeTechList(list).join(', ');
}

/** Infer expected stack from the course subject only (not assignment description). */
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

/** @deprecated Use inferRequiredTechFromSubject — kept for callers that still import it. */
export function inferRequiredTechFromAssignmentContext(assignment) {
  return inferRequiredTechFromSubject(assignment?.subject);
}

/** Teacher-stated stack first; subject inference only when nothing else is specified. */
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
  isCollaborative = false,
} = {}) {
  if (isCollaborative) return { ok: true };

  const subjectTech = inferRequiredTechFromSubject(subject);
  const allowed = canonicalizeTechList(toList(allowedTechnologies));
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

export function buildProposalRequirementText(proposalLike) {
  return [
    proposalLike?.title || '',
    proposalLike?.description || '',
    ...(Array.isArray(proposalLike?.features) ? proposalLike.features : []),
  ]
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .join('\n\n');
}

export function buildTeacherRequirementCorpus(assignment) {
  if (assignment?.isCollaborative) {
    const sections = [];
    const fe = assignment.frontendTechRequirements || {};
    const be = assignment.backendTechRequirements || {};
    const feText = [fe.requirementText, ...(toList(fe.allowedTechnologies).map((t) => `Use ${t}`))].filter(Boolean).join('\n');
    const beText = [be.requirementText, ...(toList(be.allowedTechnologies).map((t) => `Use ${t}`))].filter(Boolean).join('\n');
    if (feText.trim()) sections.push(`Frontend requirements:\n${feText.trim()}`);
    if (beText.trim()) sections.push(`Backend requirements:\n${beText.trim()}`);
    const required = [
      ...resolveRequiredTechnologiesForProposal(assignment, fe),
      ...resolveRequiredTechnologiesForProposal(assignment, be),
    ];
    return {
      requirement_text: sections.join('\n\n'),
      requirement_sections: sections,
      required_technologies: [...new Set(required)],
    };
  }

  const requirementText = String(assignment?.requirementText || '').trim();
  const description = String(assignment?.description || '').trim();
  const allowed = toList(assignment?.allowedTechnologies);
  const keywords = toList(assignment?.requiredKeywords);
  const sections = [];
  if (requirementText) sections.push(requirementText);
  if (description && description !== requirementText) sections.push(description);
  if (allowed.length) {
    sections.push(
      `The project must use these technologies and explain how they are applied: ${allowed.join(', ')}.`
    );
  }
  if (keywords.length) {
    sections.push(
      `The proposal must address these required topics in clear sentences: ${keywords.join(', ')}.`
    );
  }

  return {
    requirement_text: sections.join('\n\n'),
    requirement_sections: sections,
    required_technologies: resolveRequiredTechnologiesForProposal(assignment, assignment),
  };
}

function blockHasRequirementRules(block) {
  if (!block || typeof block !== 'object') return false;
  return (
    Boolean(String(block.requirementText || '').trim()) ||
    toList(block.allowedTechnologies).length > 0 ||
    toList(block.requiredKeywords).length > 0
  );
}

/** True when proposal mentions at least one tech from the allowed list (incl. aliases/family). */
function proposalCoversAllowedTech(proposalText, allowedTechnologies) {
  const allowed = canonicalizeTechList(allowedTechnologies);
  if (!allowed.length) return true;
  const mentioned = detectMentionedTechnologies(proposalText);
  const expanded = expandTechFamily(allowed);
  if (mentioned.some((m) => expanded.includes(m))) return true;
  // Fallback: substring / alias check for odd spellings not in TECH_ALIASES keys.
  const src = String(proposalText || '').toLowerCase();
  return allowed.some((tech) => {
    const aliases = TECH_ALIASES.find((t) => t.key === tech)?.aliases || [tech];
    return aliases.some((a) => hasAlias(src, a));
  });
}

/**
 * Collaborative structural gate:
 * - Union FE+BE allow-lists for "disallowed stack" (so React+Node both OK).
 * - Require FE allowed tech(s) to appear when FE block has them.
 * - Require BE allowed tech(s) to appear when BE block has them.
 * Without this, empty/off-topic proposals skipped hard fails and only hit soft "review" (treated as pass).
 */
function evaluateCollaborativeRequirements(assignment, proposalLike) {
  const fe = assignment?.frontendTechRequirements || {};
  const be = assignment?.backendTechRequirements || {};
  const feAllowed = canonicalizeTechList(toList(fe.allowedTechnologies));
  const beAllowed = canonicalizeTechList(toList(be.allowedTechnologies));
  const unionAllowed = [...new Set([...feAllowed, ...beAllowed])];

  const proposalText = buildProposalRequirementText(proposalLike);
  const proposalLower = proposalText.toLowerCase();
  const mentionedTechnologies = detectMentionedTechnologies(proposalLower);

  const minChars = Number(process.env.REQUIREMENT_MIN_PROPOSAL_CHARS || 80);
  const tooShort = proposalLower.replace(/\s+/g, ' ').trim().length < minChars;

  const hasAllowedTechRule = unionAllowed.length > 0;
  const disallowedMentionedTech = hasAllowedTechRule
    ? mentionedTechnologies.filter((t) => !expandTechFamily(unionAllowed).includes(t))
    : [];

  const missingFrontendTech =
    feAllowed.length > 0 && !proposalCoversAllowedTech(proposalLower, feAllowed) ? [...feAllowed] : [];
  const missingBackendTech =
    beAllowed.length > 0 && !proposalCoversAllowedTech(proposalLower, beAllowed) ? [...beAllowed] : [];

  const reasons = [];
  if (tooShort) {
    reasons.push(
      'Proposal is too short. Write a real project description covering both frontend and backend in full sentences.'
    );
  }
  if (disallowedMentionedTech.length) {
    reasons.push(
      `Disallowed technologies for this collaborative assignment: ${disallowedMentionedTech.join(', ')}. Allowed: ${unionAllowed.join(', ') || 'none'}.`
    );
  }
  if (missingFrontendTech.length) {
    reasons.push(
      `Missing frontend technology in the proposal: ${missingFrontendTech.join(', ')}. Name it in the title, description, or features and explain how you use it.`
    );
  }
  if (missingBackendTech.length) {
    reasons.push(
      `Missing backend technology in the proposal: ${missingBackendTech.join(', ')}. Name it in the title, description, or features and explain how you use it.`
    );
  }

  const hasAnyRule = blockHasRequirementRules(fe) || blockHasRequirementRules(be) || unionAllowed.length > 0;
  const passed =
    !tooShort &&
    disallowedMentionedTech.length === 0 &&
    missingFrontendTech.length === 0 &&
    missingBackendTech.length === 0;

  return {
    hasAnyRule,
    passed,
    needsSemantic: passed && hasAnyRule,
    missingKeywords: [],
    missingAllowedTech: [...missingFrontendTech, ...missingBackendTech],
    missingImplicitTerms: [...missingFrontendTech, ...missingBackendTech],
    disallowedMentionedTech,
    matchedAllowedTech: unionAllowed.filter((t) => proposalCoversAllowedTech(proposalLower, [t])),
    implicitRequiredTerms: unionAllowed,
    summary: passed
      ? 'Structural collaborative requirement gate passed; semantic meaning check runs next.'
      : `Requirement gate failed. ${reasons.join(' | ')}`,
    semanticCorpus: buildTeacherRequirementCorpus(assignment),
    strictTechRequirements: true,
  };
}

/**
 * Structural hard gates only (wrong stack / empty).
 * Meaning match is handled by MiniLM via analyzeRequirementsPayload — NOT substring keywords.
 */
export function evaluateProposalAgainstAssignmentRequirements(assignment, proposalLike) {
  if (assignment?.isCollaborative) {
    return evaluateCollaborativeRequirements(assignment, proposalLike);
  }

  return evaluateRequirementBlock(assignment, proposalLike, '', assignment);
}

export function evaluateRequirementBlock(block, proposalLike, label = '', assignment = null) {
  const requiredKeywords = toList(block?.requiredKeywords);
  const allowedTechnologies = toList(block?.allowedTechnologies);
  const requirementText = String(block?.requirementText || '').trim();
  const assignmentContext = assignment || block;
  const implicitRequiredTerms = resolveRequiredTechnologiesForProposal(assignmentContext, block);
  const canonicalAllowedTech = canonicalizeTechList(allowedTechnologies);

  const proposalText = buildProposalRequirementText(proposalLike).toLowerCase();
  const mentionedTechnologies = detectMentionedTechnologies(proposalText);
  const hasAllowedTechRule = allowedTechnologies.length > 0;

  // Hard fail: student proposes a different stack than the allow-list (e.g. React when only PHP allowed).
  const disallowedMentionedTech = hasAllowedTechRule
    ? mentionedTechnologies.filter((t) => !expandTechFamily(canonicalAllowedTech).includes(t))
    : [];
  const noDisallowedTechPassed = disallowedMentionedTech.length === 0;

  // Soft signals for UI — no longer used as automatic pass/fail.
  const matchedAllowedTech = allowedTechnologies.filter((t) => proposalText.includes(t.toLowerCase()));
  const missingAllowedTech = allowedTechnologies.filter((t) => !proposalText.includes(t.toLowerCase()));
  const missingKeywords = requiredKeywords.filter((k) => !proposalText.includes(k.toLowerCase()));
  const missingImplicitTerms = implicitRequiredTerms.filter((t) => !proposalText.includes(t.toLowerCase()));

  const hasAnyRule =
    Boolean(requirementText) ||
    hasAllowedTechRule ||
    requiredKeywords.length > 0 ||
    implicitRequiredTerms.length > 0;

  const minChars = Number(process.env.REQUIREMENT_MIN_PROPOSAL_CHARS || 80);
  const tooShort = proposalText.replace(/\s+/g, ' ').trim().length < minChars;

  const reasons = [];
  if (tooShort) {
    reasons.push(
      'Proposal is too short. Write a real project description in full sentences — casual chat or bare technology names are not accepted.'
    );
  }
  if (!noDisallowedTechPassed) {
    reasons.push(`Disallowed technologies detected: ${disallowedMentionedTech.join(', ')}`);
  }

  const passed = !tooShort && noDisallowedTechPassed;
  const needsSemantic = passed && hasAnyRule;

  return {
    hasAnyRule,
    passed,
    needsSemantic,
    missingKeywords,
    missingAllowedTech,
    missingImplicitTerms,
    disallowedMentionedTech,
    matchedAllowedTech,
    implicitRequiredTerms,
    summary: passed
      ? `${label ? `${label}: ` : ''}Structural requirement gate passed; semantic meaning check runs next.`.trim()
      : `${label ? `${label} — ` : ''}Requirement gate failed. ${reasons.join(' | ')}`.trim(),
    semanticCorpus: buildTeacherRequirementCorpus(assignmentContext),
  };
}

/**
 * Merge MiniLM semantic result into the requirement check object used by the workflow.
 * verdict: reject | review | pass
 */
export function applySemanticRequirementResult(structuralCheck, semanticResult) {
  const verdict = String(semanticResult?.verdict || 'reject').toLowerCase();
  const similarity = Number(semanticResult?.similarity ?? 0);
  const summary = String(semanticResult?.summary || '').trim() || structuralCheck.summary;

  if (verdict === 'pass') {
    return {
      ...structuralCheck,
      passed: true,
      needsReview: false,
      semanticVerdict: 'pass',
      semanticSimilarity: similarity,
      summary,
      matchedAllowedTech: structuralCheck.matchedAllowedTech,
    };
  }

  if (verdict === 'review') {
    return {
      ...structuralCheck,
      passed: true,
      needsReview: true,
      semanticVerdict: 'review',
      semanticSimilarity: similarity,
      summary,
    };
  }

  return {
    ...structuralCheck,
    passed: false,
    needsReview: false,
    semanticVerdict: 'reject',
    semanticSimilarity: similarity,
    summary,
  };
}

export {
  canonicalizeTechList,
  detectMentionedTechnologies,
  techFamiliesOverlap,
  expandTechFamily,
  TECH_ALIASES,
  TECH_COMPATIBILITY,
};
