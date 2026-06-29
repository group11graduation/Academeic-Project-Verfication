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
  { key: 'react', aliases: ['react', 'reactjs', 'react.js'] },
  { key: 'flutter', aliases: ['flutter'] },
  { key: 'java', aliases: ['java'] },
  { key: 'python', aliases: ['python'] },
  { key: 'laravel', aliases: ['laravel'] },
  { key: 'spring boot', aliases: ['spring boot'] },
  { key: 'django', aliases: ['django'] },
];

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

function buildImplicitRequiredTerms(requirementText) {
  const text = String(requirementText || '').toLowerCase();
  if (!text) return [];

  return detectMentionedTechnologies(text);
}

export function evaluateProposalAgainstAssignmentRequirements(assignment, proposalLike) {
  if (assignment?.isCollaborative) {
    const frontendCheck = evaluateRequirementBlock(assignment?.frontendTechRequirements, proposalLike, 'Frontend');
    const backendCheck = evaluateRequirementBlock(assignment?.backendTechRequirements, proposalLike, 'Backend');
    const passed = frontendCheck.passed && backendCheck.passed;
    return {
      hasAnyRule: frontendCheck.hasAnyRule || backendCheck.hasAnyRule,
      passed,
      missingKeywords: [...frontendCheck.missingKeywords, ...backendCheck.missingKeywords],
      missingAllowedTech: [...frontendCheck.missingAllowedTech, ...backendCheck.missingAllowedTech],
      missingImplicitTerms: [...frontendCheck.missingImplicitTerms, ...backendCheck.missingImplicitTerms],
      disallowedMentionedTech: [...frontendCheck.disallowedMentionedTech, ...backendCheck.disallowedMentionedTech],
      matchedAllowedTech: [...frontendCheck.matchedAllowedTech, ...backendCheck.matchedAllowedTech],
      summary: passed
        ? 'Proposal satisfies collaborative frontend and backend requirement pre-check.'
        : `Requirement pre-check failed. ${[frontendCheck.summary, backendCheck.summary].filter((s) => !s.includes('satisfies')).join(' | ')}`,
    };
  }

  return evaluateRequirementBlock(assignment, proposalLike);
}

function evaluateRequirementBlock(block, proposalLike, label = '') {
  const requiredKeywords = toList(block?.requiredKeywords);
  const allowedTechnologies = toList(block?.allowedTechnologies);
  const requirementText = String(block?.requirementText || block?.description || '').trim();
  const implicitRequiredTerms = buildImplicitRequiredTerms(requirementText);
  const canonicalAllowedTech = canonicalizeTechList(allowedTechnologies);

  const proposalText = [
    proposalLike?.title || '',
    proposalLike?.description || '',
    ...(Array.isArray(proposalLike?.features) ? proposalLike.features : []),
  ]
    .join(' ')
    .toLowerCase();

  const missingKeywords = requiredKeywords.filter((k) => !proposalText.includes(k.toLowerCase()));
  const matchedAllowedTech = allowedTechnologies.filter((t) => proposalText.includes(t.toLowerCase()));
  const missingAllowedTech = allowedTechnologies.filter((t) => !proposalText.includes(t.toLowerCase()));
  const missingImplicitTerms = implicitRequiredTerms.filter((t) => !proposalText.includes(t.toLowerCase()));
  const mentionedTechnologies = detectMentionedTechnologies(proposalText);
  const hasAllowedTechRule = allowedTechnologies.length > 0;
  const allowedTechPassed = !hasAllowedTechRule || missingAllowedTech.length === 0;
  const disallowedMentionedTech = hasAllowedTechRule
    ? mentionedTechnologies.filter((t) => !canonicalAllowedTech.includes(t))
    : [];
  const noDisallowedTechPassed = disallowedMentionedTech.length === 0;
  const requiredKeywordsPassed = missingKeywords.length === 0;
  const implicitTermsPassed = missingImplicitTerms.length === 0;

  const hasAnyRule =
    Boolean(requirementText) ||
    hasAllowedTechRule ||
    requiredKeywords.length > 0 ||
    implicitRequiredTerms.length > 0;
  const passed =
    !hasAnyRule || (requiredKeywordsPassed && allowedTechPassed && implicitTermsPassed && noDisallowedTechPassed);

  const reasons = [];
  if (!requiredKeywordsPassed) {
    reasons.push(`Missing required keywords: ${missingKeywords.join(', ')}`);
  }
  if (!allowedTechPassed) {
    reasons.push(`Missing required technologies: ${missingAllowedTech.join(', ')}`);
  }
  if (!implicitTermsPassed) {
    reasons.push(`Missing required technologies from teacher text: ${missingImplicitTerms.join(', ')}`);
  }
  if (!noDisallowedTechPassed) {
    reasons.push(`Disallowed technologies detected: ${disallowedMentionedTech.join(', ')}`);
  }

  return {
    hasAnyRule,
    passed,
    missingKeywords,
    missingAllowedTech,
    missingImplicitTerms,
    disallowedMentionedTech,
    matchedAllowedTech,
    summary: passed
      ? `${label ? `${label}: ` : ''}Proposal satisfies teacher requirement pre-check.`.trim()
      : `${label ? `${label} — ` : ''}Requirement pre-check failed. ${reasons.join(' | ')}`.trim(),
  };
}

