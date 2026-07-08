import { logger } from '../config/logger.js';
import { getAiServiceUrl } from '../config/env.js';

/**
 * Base URL for the FastAPI AI service (proposal, code, screenshot).
 * Same host as used for `POST /analyze/proposal`.
 *
 * Related Python routes (see `backend-python/docs/API_AND_STRUCTURE.md`):
 * - POST /analyze/proposal — sentence-transformers + same-semester / legacy thresholds (used below).
 * - POST /analyze/code — tree-sitter fingerprints + TF-IDF; optional CodeBERT if enabled server-side.
 * - POST /analyze/screenshot — Pillow + ImageHash phash vs stored reference hashes.
 */
function aiBaseUrl() {
  return getAiServiceUrl();
}

function aiTimeoutMs(path) {
  // Proposal analysis can be slow on first run (model download / warm-up).
  const perPath =
    path === '/analyze/proposal'
      ? process.env.AI_PROPOSAL_TIMEOUT_MS
      : process.env.AI_SERVICE_TIMEOUT_MS;
  return Number(perPath || process.env.AI_SERVICE_TIMEOUT_MS || 600000);
}

async function postJson(path, body) {
  const url = `${aiBaseUrl()}${path}`;
  const timeout = aiTimeoutMs(path);
  const retries = Number(process.env.AI_SERVICE_RETRIES || 1);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(id);
      if (!res.ok) {
        const t = await res.text();
        logger.error(`AI service error ${res.status} ${path}: ${t}`);
        throw new Error('AI analysis service unavailable');
      }
      return res.json();
    } catch (e) {
      clearTimeout(id);
      if (e.name === 'AbortError') {
        const lastTry = attempt === retries;
        logger.error(`AI timeout ${path} after ${timeout}ms (attempt ${attempt + 1}/${retries + 1})`);
        if (!lastTry) continue;
        throw new Error(`AI analysis timed out after ${Math.round(timeout / 1000)}s`);
      }
      throw e;
    }
  }
  throw new Error('AI analysis service unavailable');
}

/**
 * Proposal pipeline: semantic similarity vs same-semester peers and legacy projects.
 * `payload` must match Python `ProposalAnalyzeIn`: `{ text, same_semester?, legacy? }`.
 */
export async function analyzeProposalPayload(payload) {
  return postJson('/analyze/proposal', payload);
}

/**
 * Optional: code similarity vs reference snippets (wire from a plagiarism job or teacher review).
 * Body: `{ source, language?, references: [{ id, text, language? }] }`.
 */
export async function analyzeCodePayload(payload) {
  return postJson('/analyze/code', payload);
}

/**
 * Optional: screenshot duplicate warning (compare phash to hashes stored from prior submissions).
 * Body: `{ image_base64, reference_hashes?, hamming_threshold? }`.
 */
export async function analyzeScreenshotPayload(payload) {
  return postJson('/analyze/screenshot', payload);
}
