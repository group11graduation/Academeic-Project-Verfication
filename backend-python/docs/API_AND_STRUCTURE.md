# Python AI service — layout, APIs, Node integration

## Folder structure

```
backend-python/
├── app/
│   ├── main.py                 # FastAPI factory + CORS
│   ├── config/
│   │   └── settings.py         # env-backed settings (pydantic-settings)
│   ├── middleware/
│   │   └── request_id.py
│   ├── models/
│   │   └── schemas.py          # Pydantic request/response models
│   ├── preprocessing/          # Pure helpers (no FastAPI imports)
│   │   ├── text.py             # Proposal text normalization
│   │   ├── code_ast.py         # tree-sitter fingerprint extraction
│   │   └── image_prep.py       # Pillow decode + resize for hashing
│   ├── routers/
│   │   ├── health.py
│   │   └── analyze.py          # /analyze/* endpoints
│   ├── services/
│   │   ├── proposal_semantic.py    # sentence-transformers + verdict
│   │   ├── proposal_similarity.py  # shim → proposal_semantic
│   │   ├── code_similarity.py      # tree-sitter + TF-IDF; optional CodeBERT
│   │   └── screenshot_similarity.py # ImageHash phash
│   └── utils/
│       └── text.py             # re-exports preprocessing helpers
├── docs/
│   └── API_AND_STRUCTURE.md    # (this file)
├── requirements.txt
└── Dockerfile
```

## API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness |
| POST | `/analyze/proposal` | Same-semester conflict + previous-semester warning (Node) |
| POST | `/analyze/code` | Code similarity vs reference snippets |
| POST | `/analyze/screenshot` | Screenshot duplicate warning vs stored phash hex strings |

OpenAPI UI: `http://localhost:8000/docs`

## Request / response schemas (summary)

### `POST /analyze/proposal`

**Request** (`ProposalAnalyzeIn`):

| Field | Type | Description |
|-------|------|-------------|
| `text` | string | Current proposal flattened text (title + description + features) |
| `same_semester` | array | `{ "id": "<ObjectId>", "text": "..." }` peers in current cohort |
| `legacy` | array | `{ "id": "<ObjectId>", "text": "..." }` prior semester/year projects |

Extra keys on peer objects (e.g. `title`) are ignored.

**Response** (JSON object; also compatible with `ProposalAnalyzeOut`):

| Field | Type |
|-------|------|
| `same_semester_max` | float 0–1 |
| `legacy_max` | float 0–1 |
| `matched_proposal_id` | string or null |
| `matched_legacy_id` | string or null |
| `verdict` | `"reject_same_semester"` \| `"warn_previous_semester"` \| `"ok"` |
| `summary` | string |
| `backend` | `"sentence_transformers"` \| `"tfidf"` (extra field for observability) |

Thresholds: `AI_SAME_SEMESTER_REJECT` (default `0.72`), `AI_PREVIOUS_SEMESTER_WARN` (default `0.58`).

### `POST /analyze/code`

**Request** (`CodeAnalyzeIn`):

| Field | Type |
|-------|------|
| `source` | string (submission code) |
| `language` | string, default `python` (tree-sitter language id) |
| `references` | `[{ "id": "...", "text": "...", "language": "python" }]` |

**Response** (`CodeAnalyzeOut`):

| Field | Type |
|-------|------|
| `max_similarity` | float |
| `matched_id` | string or null |
| `method` | `tree_sitter_tfidf` \| `codebert` \| `fallback_char` |
| `warning` | bool (vs `CODE_SIMILARITY_WARN_THRESHOLD`) |
| `detail` | string |

### `POST /analyze/screenshot`

**Request** (`ScreenshotAnalyzeIn`):

| Field | Type |
|-------|------|
| `image_base64` | raw base64 or `data:image/...;base64,...` |
| `reference_hashes` | list of hex strings from prior `phash` values |
| `hamming_threshold` | int (warn if best Hamming distance ≤ threshold) |

**Response** (`ScreenshotAnalyzeOut`):

| Field | Type |
|-------|------|
| `phash_hex` | current image phash hex |
| `best_match_hash` | closest reference or null |
| `min_hamming_distance` | int or null |
| `warning` | bool |
| `message` | string |

## Environment variables (selection)

| Variable | Default | Role |
|----------|---------|------|
| `AI_SAME_SEMESTER_REJECT` | `0.72` | Same-semester cosine reject |
| `AI_PREVIOUS_SEMESTER_WARN` | `0.58` | Legacy cosine warn |
| `USE_TFIDF_FALLBACK` | `false` | Force TF-IDF instead of sentence-transformers |
| `SENTENCE_TRANSFORMER_MODEL` | `all-MiniLM-L6-v2` | Embedding model |
| `MODELS_CACHE_DIR` | `/tmp/academic-ai-models` | Model cache |
| `CODEBERT_ENABLED` | `false` | Use CodeBERT for `/analyze/code` |
| `CODE_SIMILARITY_WARN_THRESHOLD` | `0.85` | Code warning cutoff |

## Node orchestration (example) 

The orchestration API already calls proposal analysis:


```js
// backend-node/src/services/aiClient.service.js
const base = (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');
const res = await fetch(`${base}/analyze/proposal`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text, same_semester, legacy }),
});
```

Optional additional calls from Node (e.g. plagiarism job, report screenshot check):

```js
await fetch(`${base}/analyze/code`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    source: code,
    language: 'python',
    references: [{ id: 'ref1', text: refCode, language: 'python' }],
  }),
});

await fetch(`${base}/analyze/screenshot`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    image_base64: b64,
    reference_hashes: ['abc...', 'def...'],
    hamming_threshold: 10,
  }),
});
```
