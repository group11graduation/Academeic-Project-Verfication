import { loadCollaborativeRequirementFileTexts, extractRequirementFileText } from './requirementFileText.service.js';

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
  {
    key: 'spring boot',
    aliases: ['spring boot', 'springboot', 'spring-boot', 'spring framework', 'springframework'],
  },
  { key: 'thymeleaf', aliases: ['thymeleaf'] },
  { key: 'django', aliases: ['django'] },
];

const TECH_COMPATIBILITY = {
  // Language/framework families only - shared DBs (mysql/postgres/mongo) must NOT
  // imply a language, or "Spring Boot + MySQL" would wrongly allow PHP proposals.
  php: ['php', 'laravel'],
  mysql: ['mysql'],
  laravel: ['php', 'laravel'],
  java: ['java', 'spring boot', 'thymeleaf'],
  'spring boot': ['java', 'spring boot', 'thymeleaf'],
  thymeleaf: ['java', 'spring boot', 'thymeleaf'],
  python: ['python', 'django'],
  django: ['python', 'django'],
  react: ['react', 'node.js'],
  'node.js': ['node.js', 'react'],
  flutter: ['flutter'],
  postgresql: ['postgresql'],
  mongodb: ['mongodb'],
};

/** App languages / frameworks that define the assignment stack (not shared databases). */
const PRIMARY_STACK_TECHS = new Set([
  'php',
  'laravel',
  'java',
  'spring boot',
  'thymeleaf',
  'python',
  'django',
  'react',
  'node.js',
  'flutter',
]);

/**
 * OR-alternative groups from teacher wording like "PostgreSQL or MySQL".
 * Satisfying any member covers the whole group.
 */
const TECH_OR_GROUPS = [
  ['mysql', 'postgresql'],
  ['java', 'spring boot', 'thymeleaf'],
  ['php', 'laravel'],
  ['python', 'django'],
];

function primaryStackTechs(techList) {
  return canonicalizeTechList(techList).filter((t) => PRIMARY_STACK_TECHS.has(t));
}

/** Partition required techs into OR-groups (each group must be covered by ≥1 member). */
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

/** @deprecated Use inferRequiredTechFromSubject - kept for callers that still import it. */
export function inferRequiredTechFromAssignmentContext(assignment) {
  return inferRequiredTechFromSubject(assignment?.subject);
}

/** Teacher-stated stack first; then requirement file / text; subject inference last. */
export function resolveRequiredTechnologiesForProposal(assignment, block) {
  const allowedTechnologies = toList(block?.allowedTechnologies);
  const requirementText = String(block?.requirementText || '').trim();
  const description = String(block?.description || assignment?.description || '').trim();
  const fileText = String(
    block?._extractedFileText || assignment?._extractedAssignmentFileText || ''
  ).trim();

  if (allowedTechnologies.length > 0) {
    return canonicalizeTechList(allowedTechnologies);
  }

  const fromTeacherText = detectMentionedTechnologies(
    `${requirementText} ${description} ${fileText}`
  );
  if (fromTeacherText.length > 0) {
    return fromTeacherText;
  }

  // Requirements file was uploaded but could not be read - do NOT invent a stack from the
  // course subject (that falsely rejects Spring Boot proposals on a PHP-named subject, etc.).
  const fileRef = String(
    block?.assignmentFile ||
      assignment?.assignmentFile ||
      block?.requirementFile ||
      ''
  ).trim();
  if (fileRef && !fileText) {
    return [];
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
    // Prefer preloaded file text (set by buildTeacherRequirementCorpusAsync).
    const feBody = [
      fe._extractedFileText,
      fe.requirementText,
      fe.description,
      ...(toList(fe.allowedTechnologies).map((t) => `Use ${t}`)),
    ]
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .join('\n');
    const beBody = [
      be._extractedFileText,
      be.requirementText,
      be.description,
      ...(toList(be.allowedTechnologies).map((t) => `Use ${t}`)),
    ]
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .join('\n');
    if (feBody.trim()) sections.push(`Frontend requirements:\n${feBody.trim()}`);
    if (beBody.trim()) sections.push(`Backend requirements:\n${beBody.trim()}`);

    const feTechs = resolveRequiredTechnologiesForProposal(assignment, {
      ...fe,
      requirementText: feBody || fe.requirementText,
      _extractedFileText: fe._extractedFileText || feBody,
    });
    const beTechs = resolveRequiredTechnologiesForProposal(assignment, {
      ...be,
      requirementText: beBody || be.requirementText,
      _extractedFileText: be._extractedFileText || beBody,
    });

    // Stubs alone (filename only) are NOT usable requirement content for AI matching.
    const hasRealFeContent = Boolean(feBody.trim());
    const hasRealBeContent = Boolean(beBody.trim());
    if (!sections.length) {
      if (fe.requirementFile) {
        sections.push(
          `Frontend requirements are provided in file: ${fe.originalFileName || fe.requirementFile}`
        );
      }
      if (be.requirementFile) {
        sections.push(
          `Backend requirements are provided in file: ${be.originalFileName || be.requirementFile}`
        );
      }
    }

    return {
      requirement_text: sections.join('\n\n'),
      requirement_sections: sections,
      required_technologies: [...new Set([...feTechs, ...beTechs])],
      frontend_requirement_text: feBody.trim(),
      backend_requirement_text: beBody.trim(),
      frontend_required_technologies: feTechs,
      backend_required_technologies: beTechs,
      hasRealCollaborativeContent: hasRealFeContent || hasRealBeContent,
      hasRealFrontendContent: hasRealFeContent,
      hasRealBackendContent: hasRealBeContent,
    };
  }

  const requirementText = String(assignment?.requirementText || '').trim();
  const description = String(assignment?.description || '').trim();
  const allowed = toList(assignment?.allowedTechnologies);
  const keywords = toList(assignment?.requiredKeywords);
  const sections = [];
  if (requirementText) sections.push(requirementText);
  if (description && description !== requirementText) sections.push(description);
  const fileText = String(assignment?._extractedAssignmentFileText || '').trim();
  if (fileText) sections.push(fileText);
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
    required_technologies: resolveRequiredTechnologiesForProposal(assignment, {
      ...assignment,
      requirementText: [requirementText, fileText].filter(Boolean).join('\n'),
      _extractedFileText: fileText,
    }),
    _extractedAssignmentFileText: fileText,
  };
}

/**
 * Async corpus builder: reads FE + BE requirement files from disk so MiniLM
 * compares the proposal against the real uploaded requirement documents.
 */
export async function buildTeacherRequirementCorpusAsync(assignment) {
  if (!assignment?.isCollaborative) {
    const fileRef = assignment?.assignmentFile;
    if (fileRef) {
      const text = await extractRequirementFileText(fileRef);
      const corpus = buildTeacherRequirementCorpus({
        ...assignment,
        _extractedAssignmentFileText: text,
      });
      corpus._extractedAssignmentFileText = text;
      corpus._fileLoadMeta = {
        assignmentFileLoaded: true,
        assignmentFileEmpty: !String(text || '').trim(),
        assignmentFileChars: String(text || '').length,
      };
      return corpus;
    }
    return buildTeacherRequirementCorpus(assignment);
  }

  const loaded = await loadCollaborativeRequirementFileTexts(assignment);
  const fe = { ...(assignment.frontendTechRequirements || {}) };
  const be = { ...(assignment.backendTechRequirements || {}) };
  // Prefer raw extracted file text for tech detection (not mixed typed stubs).
  fe._extractedFileText = loaded.frontendText;
  be._extractedFileText = loaded.backendText;

  const enriched = {
    ...assignment,
    frontendTechRequirements: fe,
    backendTechRequirements: be,
  };
  const corpus = buildTeacherRequirementCorpus(enriched);
  corpus._fileLoadMeta = {
    frontendFileLoaded: loaded.frontendFileLoaded,
    backendFileLoaded: loaded.backendFileLoaded,
    frontendFileEmpty: loaded.frontendFileEmpty,
    backendFileEmpty: loaded.backendFileEmpty,
    frontendChars: loaded.frontendText.length,
    backendChars: loaded.backendText.length,
  };
  corpus._frontendExtractedText = loaded.frontendText;
  corpus._backendExtractedText = loaded.backendText;
  return corpus;
}

function blockHasRequirementRules(block) {
  if (!block || typeof block !== 'object') return false;
  return (
    Boolean(String(block.requirementText || '').trim()) ||
    Boolean(String(block.requirementFile || '').trim()) ||
    Boolean(String(block._extractedFileText || '').trim()) ||
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
 * - Read both FE and BE requirement files.
 * - Proposal must cover each side's primary stack (React on FE, Spring/PHP/… on BE).
 * - Meaning match against both files is done next via dual MiniLM checks.
 */
function evaluateCollaborativeRequirements(assignment, proposalLike, corpusOverride = null) {
  const fe = assignment?.frontendTechRequirements || {};
  const be = assignment?.backendTechRequirements || {};
  const corpus = corpusOverride || buildTeacherRequirementCorpus(assignment);

  let feAllowed = canonicalizeTechList(
    toList(fe.allowedTechnologies).length
      ? toList(fe.allowedTechnologies)
      : corpus.frontend_required_technologies || []
  );
  let beAllowed = canonicalizeTechList(
    toList(be.allowedTechnologies).length
      ? toList(be.allowedTechnologies)
      : corpus.backend_required_technologies || []
  );

  // Infer stack from each side's requirement file/text when teachers only uploaded files.
  if (!feAllowed.length) {
    const feBlob = [fe._extractedFileText, fe.requirementText, fe.description].filter(Boolean).join('\n');
    feAllowed = detectMentionedTechnologies(feBlob);
  }
  if (!beAllowed.length) {
    const beBlob = [be._extractedFileText, be.requirementText, be.description].filter(Boolean).join('\n');
    beAllowed = detectMentionedTechnologies(beBlob);
  }

  const fePrimary = primaryStackTechs(feAllowed);
  const bePrimary = primaryStackTechs(beAllowed);
  const feStack = fePrimary.length ? fePrimary : feAllowed;
  const beStack = bePrimary.length ? bePrimary : beAllowed;

  const unionAllowed = [...new Set([...feAllowed, ...beAllowed, ...(corpus.required_technologies || [])])];

  const proposalText = buildProposalRequirementText(proposalLike);
  const proposalLower = proposalText.toLowerCase();
  const mentionedTechnologies = detectMentionedTechnologies(proposalLower);
  const mentionedPrimary = primaryStackTechs(mentionedTechnologies);

  const minChars = Number(process.env.REQUIREMENT_MIN_PROPOSAL_CHARS || 80);
  const tooShort = proposalLower.replace(/\s+/g, ' ').trim().length < minChars;

  const feExpanded = expandTechFamily(feStack);
  const beExpanded = expandTechFamily(beStack);
  const allowedExpanded = expandTechFamily(
    primaryStackTechs(unionAllowed).length ? primaryStackTechs(unionAllowed) : unionAllowed
  );

  const hasAllowedTechRule = feStack.length > 0 || beStack.length > 0;
  const disallowedMentionedTech = hasAllowedTechRule
    ? mentionedPrimary.filter((t) => !allowedExpanded.includes(t))
    : [];

  // Each side must be covered (OR-groups within that side).
  const missingFeGroups = requiredTechGroups(feStack).filter(
    (g) => !proposalCoversAllowedTech(proposalLower, g)
  );
  const missingBeGroups = requiredTechGroups(beStack).filter(
    (g) => !proposalCoversAllowedTech(proposalLower, g)
  );
  const missingFrontendTech = missingFeGroups.map((g) => formatTechGroup(g));
  const missingBackendTech = missingBeGroups.map((g) => formatTechGroup(g));

  const fileMeta = corpus._fileLoadMeta || {};
  const reasons = [];
  if (tooShort) {
    reasons.push(
      'Proposal is too short. Write a real project description covering both frontend and backend in full sentences.'
    );
  }
  if (disallowedMentionedTech.length) {
    reasons.push(
      `Disallowed technologies for this collaborative assignment: ${disallowedMentionedTech.join(', ')}. ` +
        `Frontend expects: ${feStack.join(', ') || 'n/a'}; backend expects: ${beStack.join(', ') || 'n/a'}.`
    );
  }
  if (missingFrontendTech.length) {
    reasons.push(
      `Missing frontend technology from the frontend teacher requirements file: ${missingFrontendTech.join(', ')}. ` +
        `Name and explain it in the title, description, or features.`
    );
  }
  if (missingBackendTech.length) {
    reasons.push(
      `Missing backend technology from the backend teacher requirements file: ${missingBackendTech.join(', ')}. ` +
        `Name and explain it in the title, description, or features.`
    );
  }

  const fileReadIssues = [];
  if (fileMeta.frontendFileEmpty) {
    fileReadIssues.push(
      'Frontend requirements file could not be read. Teacher should re-upload as .docx, .txt, .md, or .pdf.'
    );
  }
  if (fileMeta.backendFileEmpty) {
    fileReadIssues.push(
      'Backend requirements file could not be read. Teacher should re-upload as .docx, .txt, .md, or .pdf.'
    );
  }

  const hasFiles = Boolean(fe.requirementFile || be.requirementFile);
  const hasRealContent = Boolean(corpus.hasRealCollaborativeContent);
  const hasAnyRule =
    blockHasRequirementRules(fe) ||
    blockHasRequirementRules(be) ||
    unionAllowed.length > 0 ||
    hasFiles ||
    hasRealContent;

  const bothFilesReadable =
    (!fe.requirementFile || !fileMeta.frontendFileEmpty) &&
    (!be.requirementFile || !fileMeta.backendFileEmpty);

  // Only real extracted/typed requirement text counts - not "file: path.docx" stubs.
  const canCheckAgainstRequirements =
    hasRealContent || feStack.length > 0 || beStack.length > 0;

  const structuralOk =
    !tooShort &&
    disallowedMentionedTech.length === 0 &&
    missingFrontendTech.length === 0 &&
    missingBackendTech.length === 0;

  const needsTeacherFileReview = Boolean(hasFiles && !canCheckAgainstRequirements);

  if (needsTeacherFileReview) {
    return {
      hasAnyRule: true,
      passed: true,
      needsReview: true,
      needsSemantic: false,
      collaborative: true,
      missingKeywords: [],
      missingAllowedTech: [],
      missingImplicitTerms: [],
      disallowedMentionedTech: [],
      matchedAllowedTech: [],
      implicitRequiredTerms: unionAllowed,
      frontendRequiredTech: feStack,
      backendRequiredTech: beStack,
      summary: `Collaborative requirement files could not be read for AI checking. Sent to teacher for manual review. ${fileReadIssues.join(' ')}`.trim(),
      semanticCorpus: corpus,
      strictTechRequirements: true,
    };
  }

  return {
    hasAnyRule: hasAnyRule || hasFiles,
    passed: structuralOk,
    needsReview: false,
    needsSemantic: structuralOk && canCheckAgainstRequirements,
    collaborative: true,
    missingKeywords: [],
    missingAllowedTech: [...missingFrontendTech, ...missingBackendTech],
    missingImplicitTerms: [...missingFrontendTech, ...missingBackendTech],
    disallowedMentionedTech,
    matchedAllowedTech: unionAllowed.filter((t) => proposalCoversAllowedTech(proposalLower, [t])),
    implicitRequiredTerms: unionAllowed,
    frontendRequiredTech: feStack,
    backendRequiredTech: beStack,
    summary: structuralOk
      ? bothFilesReadable && hasRealContent
        ? 'Structural collaborative gate passed (FE + BE stacks present). Next: AI compares the proposal to both teacher requirement files.'
        : `Structural gate passed using available FE/BE technologies. ${fileReadIssues.join(' ')}`.trim()
      : `Requirement gate failed. ${reasons.join(' | ')}`,
    semanticCorpus: corpus,
    strictTechRequirements: true,
  };
}

/**
 * Structural hard gates only (wrong stack / empty).
 * Meaning match is handled by MiniLM via analyzeRequirementsPayload - NOT substring keywords.
 * For collaborative assignments this is async (reads FE/BE requirement files).
 */
export async function evaluateProposalAgainstAssignmentRequirements(assignment, proposalLike) {
  if (assignment?.isCollaborative) {
    const corpus = await buildTeacherRequirementCorpusAsync(assignment);
    const fe = {
      ...(assignment.frontendTechRequirements || {}),
      _extractedFileText:
        corpus._frontendExtractedText ||
        corpus.frontend_requirement_text ||
        '',
    };
    const be = {
      ...(assignment.backendTechRequirements || {}),
      _extractedFileText:
        corpus._backendExtractedText ||
        corpus.backend_requirement_text ||
        '',
    };
    return evaluateCollaborativeRequirements(
      { ...assignment, frontendTechRequirements: fe, backendTechRequirements: be },
      proposalLike,
      corpus
    );
  }

  const corpus = await buildTeacherRequirementCorpusAsync(assignment);
  const extracted = String(corpus._extractedAssignmentFileText || '').trim();
  const enrichedAssignment = {
    ...assignment,
    _extractedAssignmentFileText: extracted,
  };
  const blockResult = evaluateRequirementBlock(
    enrichedAssignment,
    proposalLike,
    '',
    enrichedAssignment,
    {
      requiredStackOverride: corpus.required_technologies || [],
      fileLoadMeta: corpus._fileLoadMeta || null,
    }
  );
  const hasCorpusText = Boolean(String(corpus.requirement_text || '').trim());
  return {
    ...blockResult,
    semanticCorpus: corpus,
    strictTechRequirements: Boolean(
      (corpus.required_technologies || []).length || extracted
    ),
    hasAnyRule:
      blockResult.hasAnyRule ||
      Boolean(assignment?.assignmentFile) ||
      hasCorpusText,
    // Respect early teacher-review path (unreadable file with no usable content).
    needsSemantic:
      blockResult.needsReview
        ? false
        : Boolean(
            blockResult.passed &&
              blockResult.needsSemantic !== false &&
              (blockResult.hasAnyRule || hasCorpusText || Boolean(extracted))
          ),
  };
}

export function evaluateRequirementBlock(
  block,
  proposalLike,
  label = '',
  assignment = null,
  options = {}
) {
  const requiredKeywords = toList(block?.requiredKeywords);
  const allowedTechnologies = toList(block?.allowedTechnologies);
  const requirementText = String(block?.requirementText || '').trim();
  const assignmentContext = assignment || block;
  const extractedFileText = String(
    block?._extractedFileText ||
      assignmentContext?._extractedAssignmentFileText ||
      ''
  ).trim();

  // Prefer explicit allow-list; else tech inferred from requirements file / text / subject.
  const requiredStack = canonicalizeTechList(
    Array.isArray(options.requiredStackOverride) && options.requiredStackOverride.length
      ? options.requiredStackOverride
      : allowedTechnologies.length > 0
        ? allowedTechnologies
        : resolveRequiredTechnologiesForProposal(assignmentContext, {
            ...block,
            requirementText: [requirementText, extractedFileText].filter(Boolean).join('\n'),
            _extractedFileText: extractedFileText,
          })
  );

  const proposalText = buildProposalRequirementText(proposalLike).toLowerCase();
  const mentionedTechnologies = detectMentionedTechnologies(proposalText);
  const hasRequiredStack = requiredStack.length > 0;
  const requiredPrimary = primaryStackTechs(requiredStack);
  const mentionedPrimary = primaryStackTechs(mentionedTechnologies);
  const allowedExpanded = expandTechFamily(
    requiredPrimary.length ? requiredPrimary : requiredStack
  );

  // Hard fail: student proposes a different language/framework than teacher requirements
  // (e.g. PHP when the uploaded file requires Spring Boot - even if both mention MySQL).
  const disallowedMentionedTech = hasRequiredStack
    ? mentionedPrimary.filter((t) => !allowedExpanded.includes(t))
    : [];
  const noDisallowedTechPassed = disallowedMentionedTech.length === 0;

  // Cover each required OR-group (e.g. PostgreSQL or MySQL; Java or Spring Boot).
  // Primary app stacks are checked first; DB groups only when no primary stack was stated.
  const stackForGroups = requiredPrimary.length ? requiredPrimary : requiredStack;
  const requiredGroups = requiredTechGroups(stackForGroups);
  // Also require DB group when teacher listed a DB alongside a primary stack.
  const dbGroups = requiredTechGroups(requiredStack).filter((g) =>
    g.some((t) => t === 'mysql' || t === 'postgresql' || t === 'mongodb')
  );
  const groupsToCover = [
    ...requiredGroups,
    ...dbGroups.filter(
      (dg) => !requiredGroups.some((rg) => rg.join('|') === dg.join('|'))
    ),
  ];
  const missingGroups = groupsToCover.filter((g) => !proposalCoversAllowedTech(proposalText, g));
  const missingRequiredStack = missingGroups.map((g) => formatTechGroup(g));

  // Soft signals for UI.
  const matchedAllowedTech = requiredStack.filter((t) =>
    proposalCoversAllowedTech(proposalText, [t])
  );
  const missingAllowedTech = missingRequiredStack;
  const missingKeywords = requiredKeywords.filter((k) => !proposalText.includes(k.toLowerCase()));
  const missingImplicitTerms = missingRequiredStack;

  const hasAnyRule =
    Boolean(requirementText) ||
    Boolean(String(block?.requirementFile || block?.assignmentFile || '').trim()) ||
    Boolean(extractedFileText) ||
    hasRequiredStack ||
    requiredKeywords.length > 0;

  const minChars = Number(process.env.REQUIREMENT_MIN_PROPOSAL_CHARS || 80);
  const tooShort = proposalText.replace(/\s+/g, ' ').trim().length < minChars;

  const fileMeta = options.fileLoadMeta || {};
  const reasons = [];
  if (tooShort) {
    reasons.push(
      'Proposal is too short. Write a real project description in full sentences - casual chat or bare technology names are not accepted.'
    );
  }
  if (!noDisallowedTechPassed) {
    reasons.push(
      `Disallowed technologies detected: ${disallowedMentionedTech.join(', ')}. ` +
        `This assignment requires: ${requiredStack.join(', ')}. ` +
        `Rewrite the proposal to use the required stack (from the teacher requirements file / allowed technologies).`
    );
  }
  if (missingRequiredStack.length) {
    reasons.push(
      `Missing required technology stack in the proposal: ${missingRequiredStack.join(', ')}. ` +
        `Name and explain these technologies in the title, description, or features.`
    );
  }

  const structuralOk =
    !tooShort && noDisallowedTechPassed && missingRequiredStack.length === 0;

  // Unreadable assignment file must not auto-reject students. If we have no other
  // requirement text/tech to check against, send to teacher review instead.
  const assignmentFileUnreadable = Boolean(fileMeta.assignmentFileEmpty);
  const hasUsableRequirementContent =
    Boolean(requirementText) ||
    Boolean(extractedFileText) ||
    allowedTechnologies.length > 0 ||
    requiredKeywords.length > 0;
  const needsTeacherFileReview =
    assignmentFileUnreadable &&
    !hasUsableRequirementContent &&
    Boolean(String(block?.assignmentFile || assignmentContext?.assignmentFile || '').trim());

  if (needsTeacherFileReview) {
    return {
      hasAnyRule: true,
      passed: true,
      needsReview: true,
      needsSemantic: false,
      missingKeywords,
      missingAllowedTech,
      missingImplicitTerms,
      disallowedMentionedTech,
      matchedAllowedTech,
      implicitRequiredTerms: requiredStack,
      summary:
        'Teacher requirements file could not be read for AI checking. Sent to teacher for manual review. Re-upload as .docx, .txt, .md, or .pdf.',
      semanticCorpus: buildTeacherRequirementCorpus(assignmentContext),
      strictTechRequirements: false,
    };
  }

  return {
    hasAnyRule,
    passed: structuralOk,
    needsReview: false,
    needsSemantic: structuralOk && hasAnyRule && hasUsableRequirementContent,
    missingKeywords,
    missingAllowedTech,
    missingImplicitTerms,
    disallowedMentionedTech,
    matchedAllowedTech,
    implicitRequiredTerms: requiredStack,
    summary: structuralOk
      ? assignmentFileUnreadable
        ? `${label ? `${label}: ` : ''}Structural gate passed using available technologies/text (requirements file was unreadable). Semantic check runs next.`.trim()
        : `${label ? `${label}: ` : ''}Structural requirement gate passed; semantic meaning check runs next.`.trim()
      : `${label ? `${label} - ` : ''}Requirement gate failed. ${reasons.join(' | ')}`.trim(),
    semanticCorpus: buildTeacherRequirementCorpus(assignmentContext),
    strictTechRequirements: hasRequiredStack,
  };
}

/**
 * Merge MiniLM semantic result into the requirement check object used by the workflow.
 * verdict: reject | review | pass
 *
 * Solo: if the required stack is clearly covered, allow a soft pass when MiniLM is noisy.
 * Collaborative: never soft-pass on tech names alone - both requirement files must meaningfully match.
 */
export function applySemanticRequirementResult(structuralCheck, semanticResult) {
  const verdict = String(semanticResult?.verdict || 'reject').toLowerCase();
  const similarity = Number(semanticResult?.similarity ?? 0);
  let summary = String(semanticResult?.summary || '').trim() || structuralCheck.summary;

  const isCollaborative = Boolean(structuralCheck.collaborative);

  const required = canonicalizeTechList(
    structuralCheck.implicitRequiredTerms ||
      structuralCheck.semanticCorpus?.required_technologies ||
      []
  );
  const matched = new Set(canonicalizeTechList([...(structuralCheck.matchedAllowedTech || [])]));
  const groups = requiredTechGroups(required);
  const stackCovered =
    groups.length > 0 &&
    groups.every((g) => g.some((t) => matched.has(t) || expandTechFamily([t]).some((x) => matched.has(x))));

  // Collaborative: never soft-pass on tech names alone - FE+BE requirement files must match.
  const allowStackRescue = !isCollaborative && stackCovered && similarity >= 0.28;

  if (verdict === 'pass' || (allowStackRescue && structuralCheck.passed !== false)) {
    const passSummary =
      verdict === 'pass'
        ? summary
        : `Proposal matches the teacher requirements stack (similarity ${similarity.toFixed(2)}).`;
    return {
      ...structuralCheck,
      passed: true,
      needsReview: false,
      semanticVerdict: 'pass',
      semanticSimilarity: similarity,
      summary: passSummary,
      matchedAllowedTech: structuralCheck.matchedAllowedTech,
    };
  }

  if (verdict === 'review') {
    summary =
      summary ||
      `Rejected automatically: proposal does not clearly meet teacher requirements (similarity ${similarity.toFixed(2)}).`;
    if (!/reject/i.test(summary)) {
      summary = `Rejected automatically: ${summary.replace(/^Borderline requirement match/i, 'requirement match unclear')}`;
    }
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

/**
 * Collaborative: proposal must pass semantic match against BOTH FE and BE requirement files.
 */
export function mergeCollaborativeSemanticResults(structuralCheck, feSemantic, beSemantic) {
  const fe = applySemanticRequirementResult(
    { ...structuralCheck, collaborative: true, strictTechRequirements: true },
    feSemantic || { verdict: 'reject', similarity: 0, summary: 'Frontend requirements check failed.' }
  );
  const be = applySemanticRequirementResult(
    { ...structuralCheck, collaborative: true, strictTechRequirements: true },
    beSemantic || { verdict: 'reject', similarity: 0, summary: 'Backend requirements check failed.' }
  );

  const feSim = Number(fe.semanticSimilarity ?? 0);
  const beSim = Number(be.semanticSimilarity ?? 0);
  const bothPass = fe.passed && be.passed;

  if (bothPass) {
    return {
      ...structuralCheck,
      passed: true,
      needsReview: false,
      semanticVerdict: 'pass',
      semanticSimilarity: Math.min(feSim, beSim),
      summary:
        `Proposal matches both teacher requirement files ` +
        `(frontend similarity ${feSim.toFixed(2)}, backend similarity ${beSim.toFixed(2)}).`,
      matchedAllowedTech: structuralCheck.matchedAllowedTech,
      collaborative: true,
      strictTechRequirements: true,
      frontendSemanticVerdict: fe.semanticVerdict,
      backendSemanticVerdict: be.semanticVerdict,
    };
  }

  const parts = [];
  if (!fe.passed) {
    parts.push(`Frontend requirements not met: ${fe.summary || 'mismatch'}`);
  }
  if (!be.passed) {
    parts.push(`Backend requirements not met: ${be.summary || 'mismatch'}`);
  }

  return {
    ...structuralCheck,
    passed: false,
    needsReview: false,
    semanticVerdict: 'reject',
    semanticSimilarity: Math.min(feSim || 1, beSim || 1),
    summary: `Rejected automatically: ${parts.join(' | ')}`,
    matchedAllowedTech: structuralCheck.matchedAllowedTech,
    collaborative: true,
    strictTechRequirements: true,
    frontendSemanticVerdict: fe.semanticVerdict,
    backendSemanticVerdict: be.semanticVerdict,
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
