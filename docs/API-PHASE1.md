# Phase 1 REST API (Node orchestration)

Base URL: `http://localhost:5000/api` (configurable via `CORS_ORIGINS` and frontend `VITE_API_URL`).

## Auth

| Method | Path | Body | Notes |
|--------|------|------|--------|
| POST | `/auth/login` | `{ identifier, passcode }` | Email, username, employee ID, or student ID |
| GET | `/auth/me` | — | Bearer JWT |

## Admin (Bearer + role `admin`)

- `GET /admin/dashboard/stats`
- `GET|POST /admin/admins`
- Teachers: `GET|POST /admin/teachers`, `GET|PUT|DELETE /admin/teachers/:id`, `PATCH .../passcode`, `PATCH .../classes`, `PATCH .../toggle-admin`
- Students: `GET|POST /admin/students`, `GET|PUT|DELETE /admin/students/:id`, `PATCH .../passcode`
- Classes: `GET /admin/classes`, `GET /admin/classes/:code`, `POST|PUT /admin/classes`, `POST /admin/classes/:code/assign-teacher`, `POST .../generate-accounts` (501 stub)
- Subjects: `GET|POST /admin/subjects`, `GET|PUT|DELETE /admin/subjects/:id`
- `GET|POST /admin/academic-years`
- `GET|POST /admin/semesters` (query `academicYearId` optional)
- `POST /admin/enrollments`, `PATCH /admin/students/:studentUserId/performance`
- `GET|PUT /admin/settings`

## Upload

- `POST /upload` — multipart field `image` (requires auth). Returns plain text path `/uploads/...`

## Stub

- `GET /api/teacher/*`, `GET /api/student/*` → 501 until Phase 2

Full OpenAPI may be added later; this document matches Phase 1 implementation.
image.png