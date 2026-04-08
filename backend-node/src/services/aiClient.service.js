import { logger } from '../config/logger.js';

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
  return (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');
}

function aiTimeoutMs() {
  return Number(process.env.AI_SERVICE_TIMEOUT_MS || 120000);
}

async function postJson(path, body) {
  const url = `${aiBaseUrl()}${path}`;
  const timeout = aiTimeoutMs();
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
      throw new Error('AI analysis timed out');
    }
    throw e;
  }
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
