# backend-node — Orchestration API

Node.js + Express service: REST API, JWT auth, MongoDB (Mongoose), uploads, calls to **backend-python** for ML tasks, Docker preview orchestration (later), and optional job queues.

## Folder map

| Path | Role |
|------|------|
| `src/config/` | Database connection, Winston logger, env-driven settings |
| `src/routes/` | Express routers — mount paths and wire validators → controllers |
| `src/controllers/` | Thin HTTP layer: validate, invoke services, return JSON |
| `src/services/` | Business logic, persistence, integration with AI service / Docker |
| `src/models/` | Mongoose schemas and indexes |
| `src/middleware/` | Auth, RBAC, error handler, rate limits (as needed) |
| `src/validators/` | Reusable `express-validator` rules (keeps routes readable) |
| `src/utils/` | Pure helpers (API response shape, async wrappers) |
| `scripts/` | One-off maintenance (e.g. `seed.js`) |
| `uploads/` | **Deprecated path** — files live in monorepo root `../uploads/` (shared with Docker). See `uploads/MOVED.txt` if present. |

## Environment

Copy `.env.example` to `.env`.

## Scripts

- `npm run dev` — nodemon
- `npm start` — production `node src/index.js`
- `npm run seed` — seed admin + sample data

## Docker

```bash
docker build -t academic-api .
docker run --env-file .env -p 5000:5000 academic-api
```
