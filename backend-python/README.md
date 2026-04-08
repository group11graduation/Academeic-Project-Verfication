# backend-python — AI Analytics API

FastAPI service for **semantic proposal similarity**, **code similarity**, **screenshot / image-hash warnings**, and optional **CodeBERT** — orchestrated by **backend-node** over HTTP.

## Folder map

| Path | Role |
|------|------|
| `app/main.py` | FastAPI app factory, middleware, router includes |
| `app/config/` | `pydantic-settings` — env, model paths, CORS |
| `app/routers/` | `APIRouter` modules per domain (`health`, `proposals`, `code`, …) |
| `app/controllers/` | Thin handlers: call services, return Pydantic models |
| `app/services/` | ML pipelines, embeddings, tree-sitter, sklearn, heavy CPU work |
| `app/models/` | Pydantic **schemas** (request/response contracts), not DB ORM unless you add one |
| `app/middleware/` | Request ID, CORS (partially in app factory), security headers |
| `app/validators/` | Shared validation helpers beyond Pydantic `Field()` |
| `app/utils/` | Pure helpers (text normalize, tokenization helpers) |
| `main.py` (repo root) | Uvicorn entry: `uvicorn main:app` |

## Run locally

```bash
cd backend-python
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Open http://127.0.0.1:8000/docs

## Docker

```bash
docker build -t academic-ai .
docker run --env-file .env -p 8000:8000 academic-ai
```
