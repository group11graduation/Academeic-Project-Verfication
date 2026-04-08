# Validators

Reusable **express-validator** chains and rule arrays. Import them in `routes/*.routes.js` so route files stay declarative and validation stays testable.

Suggested layout:

- `common.validators.js` — ObjectId, pagination, optional string trim
- `auth.validators.js` — login, refresh (when added)
- `admin.validators.js` — create user, class codes (when extracted from routes)
