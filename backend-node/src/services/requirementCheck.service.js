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

export function evaluateProposalAgainstAssignmentRequirements(assignment, proposalLike) {
  const requiredKeywords = toList(assignment?.requiredKeywords);
  const allowedTechnologies = toList(assignment?.allowedTechnologies);
  const requirementText = String(assignment?.requirementText || '').trim();

  const proposalText = [
    proposalLike?.title || '',
    proposalLike?.description || '',
    ...(Array.isArray(proposalLike?.features) ? proposalLike.features : []),
  ]
    .join(' ')
    .toLowerCase();

  const missingKeywords = requiredKeywords.filter((k) => !proposalText.includes(k.toLowerCase()));
  const matchedAllowedTech = allowedTechnologies.filter((t) => proposalText.includes(t.toLowerCase()));
  const hasAllowedTechRule = allowedTechnologies.length > 0;
  const allowedTechPassed = !hasAllowedTechRule || matchedAllowedTech.length > 0;
  const requiredKeywordsPassed = missingKeywords.length === 0;

  const hasAnyRule = Boolean(requirementText) || hasAllowedTechRule || requiredKeywords.length > 0;
  const passed = !hasAnyRule || (requiredKeywordsPassed && allowedTechPassed);

  const reasons = [];
  if (!requiredKeywordsPassed) {
    reasons.push(`Missing required keywords: ${missingKeywords.join(', ')}`);
  }
  if (!allowedTechPassed) {
    reasons.push(`Proposal must include at least one allowed technology: ${allowedTechnologies.join(', ')}`);
  }

  return {
    hasAnyRule,
    passed,
    missingKeywords,
    matchedAllowedTech,
    summary: passed
      ? 'Proposal satisfies teacher requirement pre-check.'
      : `Requirement pre-check failed. ${reasons.join(' | ')}`,
  };
}

