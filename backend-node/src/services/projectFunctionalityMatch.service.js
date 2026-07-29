/**
 * Option 1 — Keyword / feature overlap (local, no AI).
 *
 * Proposal: title + features (+ light description boost)
 * ZIP:     README, package.json name/description, routes, models, filename
 * Reject when overlap score is below FUNCTIONALITY_MATCH_THRESHOLD.
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

/** Reject below this score (0–1). Default 0.30 ≈ 30% keyword/feature overlap. */
export const FUNCTIONALITY_MATCH_THRESHOLD = Number(
  process.env.FUNCTIONALITY_MATCH_THRESHOLD || 0.3
);

export function isFunctionalityMatchEnabled() {
  return String(process.env.ENABLE_PROJECT_FUNCTIONALITY_CHECK || 'true').toLowerCase() !== 'false';
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]+/g, ' ')
    .split(/[\s._/-]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function significantTokens(text, { minLen = 3 } = {}) {
  const out = [];
  const seen = new Set();
  for (const t of tokenize(text)) {
    if (t.length < minLen) continue;
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

function tokenInZip(token, zipTokenSet, zipLower) {
  return zipTokenSet.has(token) || zipLower.includes(token);
}

function tokenHitsZip(tokens, zipTokenSet, zipLower) {
  return tokens.filter((t) => tokenInZip(t, zipTokenSet, zipLower));
}

/** ZIP side of option 1: README + package.json identity + routes + models + filename. */
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
 * Option 1 scorer — keyword / feature overlap.
 *
 * @returns {{
 *   ok: boolean,
 *   skipped: boolean,
 *   score: number,
 *   titleCoverage: number,
 *   featureCoverage: number,
 *   keywordCoverage: number,
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

  // Option 1 primary signals: title + features (description is a light boost only).
  const titleTokens = significantTokens(title);
  const featureTokens = significantTokens(features.join('\n'));
  const descTokens = significantTokens(description);
  const proposalTokens = [...new Set([...titleTokens, ...featureTokens, ...descTokens])];

  const zipText = buildZipCorpus({ evidence, originalFilename });
  const zipLower = zipText.toLowerCase();
  const zipSlug = slugify(zipText);
  const zipTokenSet = new Set(significantTokens(zipText));

  if (titleTokens.length < 1 && featureTokens.length < 1) {
    return {
      ok: true,
      skipped: true,
      score: 1,
      titleCoverage: 1,
      featureCoverage: 1,
      keywordCoverage: 1,
      titleHits: [],
      missingTitleTokens: [],
      message: '',
    };
  }

  if (zipTokenSet.size < 2 && zipSlug.length < 8) {
    return {
      ok: false,
      skipped: false,
      score: 0,
      titleCoverage: 0,
      featureCoverage: 0,
      keywordCoverage: 0,
      titleHits: [],
      missingTitleTokens: titleTokens,
      message:
        'Your ZIP has almost no project description (README / package name). Add a README that matches your approved proposal, then upload again.',
    };
  }

  const titleHits = tokenHitsZip(titleTokens, zipTokenSet, zipLower);
  const titleCoverage = titleTokens.length ? titleHits.length / titleTokens.length : 1;

  let featureCoverage = 1;
  if (features.length) {
    let matchedFeatures = 0;
    for (const f of features) {
      const ft = significantTokens(f);
      if (!ft.length) {
        matchedFeatures += 1;
        continue;
      }
      if (tokenHitsZip(ft, zipTokenSet, zipLower).length > 0) matchedFeatures += 1;
    }
    featureCoverage = matchedFeatures / features.length;
  }

  const keywordHits = tokenHitsZip(proposalTokens, zipTokenSet, zipLower);
  const keywordCoverage = proposalTokens.length ? keywordHits.length / proposalTokens.length : 1;

  // Exact title slug in ZIP (e.g. skynovalibrary) is a strong positive signal.
  const titleSlug = slugify(title);
  const titleSlugHit = titleSlug.length >= 8 && zipSlug.includes(titleSlug);

  // Option 1 weights: title + features dominate.
  let score;
  if (features.length) {
    score = 0.55 * titleCoverage + 0.45 * featureCoverage;
  } else {
    score = 0.7 * titleCoverage + 0.3 * keywordCoverage;
  }
  if (titleSlugHit) score = Math.min(1, score + 0.15);
  score = Math.max(0, Math.min(1, score));

  const missingTitleTokens = titleTokens.filter((t) => !titleHits.includes(t));

  // Hard reject: proposal title words completely missing from ZIP (Sky Nova vs Building…).
  const hardTitleMiss = titleTokens.length >= 2 && titleCoverage === 0;

  const ok = !hardTitleMiss && score >= threshold;

  if (ok) {
    return {
      ok: true,
      skipped: false,
      score,
      titleCoverage,
      featureCoverage,
      keywordCoverage,
      titleHits,
      missingTitleTokens,
      message: '',
    };
  }

  const pct = Math.round(score * 100);
  const missingHint = missingTitleTokens.slice(0, 6).join(', ');
  const message =
    `This ZIP does not match your approved proposal (keyword/feature overlap ${pct}%). ` +
    `Upload the project that implements what you proposed — same technology alone is not enough` +
    (missingHint ? ` (missing from ZIP: ${missingHint})` : '') +
    '.';

  return {
    ok: false,
    skipped: false,
    score,
    titleCoverage,
    featureCoverage,
    keywordCoverage,
    titleHits,
    missingTitleTokens,
    message,
  };
}
