/**
 * Fast local proposal↔ZIP functionality gate (no AI).
 * Uses title/feature keywords vs README, package name, routes, models, filename.
 */

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'your',
  'our',
  'using',
  'use',
  'used',
  'based',
  'system',
  'systems',
  'app',
  'apps',
  'application',
  'applications',
  'project',
  'projects',
  'web',
  'website',
  'platform',
  'software',
  'online',
  'digital',
  'solution',
  'solutions',
  'service',
  'services',
  'user',
  'users',
  'admin',
  'data',
  'api',
  'apis',
  'backend',
  'frontend',
  'fullstack',
  'full',
  'stack',
  'client',
  'server',
  'database',
  'management',
  'manage',
  'manager',
  'main',
  'new',
  'simple',
  'basic',
  'advanced',
  'modern',
  'create',
  'created',
  'build',
  'built',
  'develop',
  'development',
  'implement',
  'implementation',
  'feature',
  'features',
  'module',
  'modules',
  'page',
  'pages',
  'allow',
  'allows',
  'provide',
  'provides',
  'include',
  'includes',
  'react',
  'node',
  'nodejs',
  'express',
  'mongodb',
  'mongo',
  'mysql',
  'postgres',
  'postgresql',
  'java',
  'spring',
  'php',
  'laravel',
  'python',
  'django',
  'flask',
  'html',
  'css',
  'javascript',
  'typescript',
  'bootstrap',
  'tailwind',
  'vite',
  'nextjs',
  'vue',
  'angular',
]);

/** Minimum combined score to accept (0–1). Override with FUNCTIONALITY_MATCH_THRESHOLD. */
export const FUNCTIONALITY_MATCH_THRESHOLD = Number(
  process.env.FUNCTIONALITY_MATCH_THRESHOLD || 0.28
);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]+/g, ' ')
    .split(/[\s._/-]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function significantTokens(text) {
  const out = [];
  const seen = new Set();
  for (const t of tokenize(text)) {
    if (t.length < 4) continue;
    if (STOP_WORDS.has(t)) continue;
    if (/^\d+$/.test(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function tokenHitsZip(tokens, zipTokenSet, zipLower) {
  return tokens.filter((t) => zipTokenSet.has(t) || zipLower.includes(t));
}

function buildZipCorpus({ evidence = {}, originalFilename = '' } = {}) {
  const nameHint = String(originalFilename || '')
    .replace(/\.zip$/i, '')
    .replace(/[-_]+/g, ' ');
  return [
    nameHint,
    evidence.package_identity || '',
    evidence.readme_text || '',
    Array.isArray(evidence.routes) ? evidence.routes.join(' ') : '',
    Array.isArray(evidence.models) ? evidence.models.join(' ') : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * @returns {{
 *   ok: boolean,
 *   skipped: boolean,
 *   score: number,
 *   titleCoverage: number,
 *   keywordCoverage: number,
 *   featureCoverage: number,
 *   titleHits: string[],
 *   missingTitleTokens: string[],
 *   message: string,
 * }}
 */
export function scoreProposalZipFunctionality({
  proposal,
  evidence = {},
  originalFilename = '',
  threshold = FUNCTIONALITY_MATCH_THRESHOLD,
} = {}) {
  const title = String(proposal?.title || '').trim();
  const description = String(proposal?.description || '').trim();
  const features = Array.isArray(proposal?.features)
    ? proposal.features.map((f) => String(f || '').trim()).filter(Boolean)
    : [];

  const proposalText = [title, description, ...features].filter(Boolean).join('\n');
  const zipText = buildZipCorpus({ evidence, originalFilename });
  const zipLower = zipText.toLowerCase();
  const zipSlug = slugify(zipText);
  const zipTokenSet = new Set(significantTokens(zipText));

  const proposalTokens = significantTokens(proposalText);
  const titleTokens = significantTokens(title);

  // Nothing distinctive to compare — don't block upload.
  if (proposalTokens.length < 2 && titleTokens.length < 2) {
    return {
      ok: true,
      skipped: true,
      score: 1,
      titleCoverage: 1,
      keywordCoverage: 1,
      featureCoverage: 1,
      titleHits: [],
      missingTitleTokens: [],
      message: '',
    };
  }

  // Empty ZIP evidence (no readme/package/routes) with a rich proposal → reject.
  if (zipTokenSet.size < 2 && zipSlug.length < 8) {
    return {
      ok: false,
      skipped: false,
      score: 0,
      titleCoverage: 0,
      keywordCoverage: 0,
      featureCoverage: 0,
      titleHits: [],
      missingTitleTokens: titleTokens,
      message:
        'Your ZIP has almost no project description (README / package name). Add a README that describes the same product as your approved proposal, then upload again.',
    };
  }

  const titleHits = tokenHitsZip(titleTokens, zipTokenSet, zipLower);
  const titleCoverage = titleTokens.length ? titleHits.length / titleTokens.length : 1;

  const keywordHits = tokenHitsZip(proposalTokens, zipTokenSet, zipLower);
  const keywordCoverage = proposalTokens.length ? keywordHits.length / proposalTokens.length : 1;

  let featureCoverage = 1;
  if (features.length) {
    let matched = 0;
    for (const f of features) {
      const ft = significantTokens(f);
      if (!ft.length) {
        matched += 1;
        continue;
      }
      if (tokenHitsZip(ft, zipTokenSet, zipLower).length > 0) matched += 1;
    }
    featureCoverage = matched / features.length;
  }

  // Title slug must appear when title is distinctive (catches renamed wrong projects).
  const titleSlug = slugify(title);
  let titleSlugBonus = 0;
  if (titleSlug.length >= 8 && zipSlug.includes(titleSlug)) {
    titleSlugBonus = 0.2;
  }

  let score =
    0.45 * titleCoverage + 0.35 * keywordCoverage + 0.2 * featureCoverage + titleSlugBonus;
  score = Math.max(0, Math.min(1, score));

  const missingTitleTokens = titleTokens.filter((t) => !titleHits.includes(t));

  // Hard fail: proposal title tokens completely absent and overall keywords weak.
  const hardTitleMiss =
    titleTokens.length >= 2 && titleCoverage === 0 && keywordCoverage < 0.22;

  const ok = !hardTitleMiss && score >= threshold;

  if (ok) {
    return {
      ok: true,
      skipped: false,
      score,
      titleCoverage,
      keywordCoverage,
      featureCoverage,
      titleHits,
      missingTitleTokens,
      message: '',
    };
  }

  const pct = Math.round(score * 100);
  const missingHint = missingTitleTokens.slice(0, 6).join(', ');
  const message =
    `This ZIP does not match your approved proposal functionality (${pct}% keyword match). ` +
    `Same technology is not enough — upload the project that implements what you proposed` +
    (missingHint ? ` (missing signals: ${missingHint})` : '') +
    '.';

  return {
    ok: false,
    skipped: false,
    score,
    titleCoverage,
    keywordCoverage,
    featureCoverage,
    titleHits,
    missingTitleTokens,
    message,
  };
}
