# =============================================================================
# Node.js orchestration API — production image
# Build:  docker build -t scholarverify-node-api ./backend-node
# Run:    see root docker-compose.yml (requires Docker socket for previews)
# =============================================================================

FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# -----------------------------------------------------------------------------
# Dependencies (production only)
# -----------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json* ./
# Use install (not ci) so Coolify builds succeed when package-lock is briefly out of sync
# (local Windows TLS issues prevent regenerating the lockfile with new deps like nodemailer).
RUN npm install --omit=dev

# -----------------------------------------------------------------------------
# Release image
# -----------------------------------------------------------------------------
FROM base AS release

# Docker CLI — the API spawns `docker build/run/stop` for student preview sandboxes.
# This is NOT full Docker-in-Docker; the daemon runs on the HOST via socket mount.
RUN apk add --no-cache docker-cli curl \
    && mkdir -p /app/uploads /app/data/preview-cache

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json* ./
COPY src ./src
COPY scripts ./scripts
# Preview stack templates (node-js, php-apache, jupyter, spring, etc.)
COPY docker-templates ./docker-templates

# Runtime defaults — override in docker-compose / orchestrator env
ENV PORT=5000
ENV UPLOAD_DIR=/app/uploads
ENV PREVIEW_CACHE_ROOT=/app/data/preview-cache
ENV DOCKER_PREVIEW_ENABLED=true

EXPOSE 5000

# Preview orchestration needs read/write on /var/run/docker.sock (mounted from host).
# On Linux you may instead use compose `group_add: ["${DOCKER_GID}"]` and USER node.
USER root

CMD ["node", "src/index.js"]
