
Teacher-driven academic workflow: admin provisioning, classes/subjects, assignments, grouping, proposals, AI checks, project submission, Docker preview, and audit trails.

This repository is organized as a **monorepo**:

| Folder | Role |
|--------|------|
| `Frontend/` | React + Vite + Tailwind SPA |
| `backend-node/` | Express + MongoDB orchestration API (JWT, RBAC, admin CRUD) |
| `backend-python/` | FastAPI AI service (Phase 1: health only; ML in later phases) |
| `docker/` | Optional Nginx / deployment notes |
| `docs/` | API notes |

## Quick start (Phase 1)

### Full stack (MongoDB + Node orchestration + Python AI)

```bash
copy .env.example .env
docker compose up --build
```

- API: http://localhost:5000  
- AI service: http://localhost:8000  
- MongoDB: `localhost:27017`  

### MongoDB only

```bash
docker compose up -d mongo
```

Or use a local MongoDB instance and set `MONGODB_URI` in `backend-node/.env` (copy from `backend-node/.env.example`).

### 2. Node API

```bash
cd backend-node
copy .env.example .env
npm install
npm run seed
npm run dev
```

Default admin (from seed): `admin@university.edu` / `Admin@123` (override with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).

### 3. Frontend

```bash
cd Frontend
copy .env.example .env
npm install
npm run dev
```

Set `VITE_API_URL` if the API is not on `http://localhost:5000`.

### 4. Python AI (optional)

```bash
cd backend-python
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Phase roadmap

1. **Done (this drop):** Folder structure, auth + JWT + roles, admin APIs, subjects/classes/academic years/semesters/enrollment foundations, seed data, Docker Compose for MongoDB, frontend API client + login validation + admin semester/import placeholders.
2. **Next:** Assignments, groups, proposals, Python similarity services, project upload, Docker preview.

See `docs/API-PHASE1.md` for endpoint summary.
