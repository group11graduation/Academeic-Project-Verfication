FROM node:20-alpine

WORKDIR /app

ENV PORT=3000
ENV HOST=0.0.0.0
ENV APP_SUBDIR=.

# Static placeholder + built dist folders — avoid npx download on every preview start.
RUN npm install -g serve@14.2.4

# mysql2 + bcryptjs for preview seeding when the student ZIP omits them.
RUN mkdir -p /preview-tools && cd /preview-tools && npm init -y >/dev/null 2>&1 \
  && npm install mysql2@3.11.5 bcryptjs@2.4.3 --omit=dev

# Student project is bind-mounted at /app at container start — not baked into the image.
COPY entrypoint.sh /preview-entrypoint.sh
COPY preview-seed-admin.js /preview-seed-admin.js
COPY preview-seed-mysql.js /preview-seed-mysql.js
COPY preview-mysql-bootstrap.js /preview-mysql-bootstrap.js
COPY preview-verify-login.js /preview-verify-login.js
COPY preview-login-fallback.js /preview-login-fallback.js
COPY preview-safety.cjs /preview-safety.cjs
COPY preview-ensure-inject.cjs /preview-ensure-inject.cjs
COPY preview-gateway.cjs /preview-gateway.cjs
# Canonical copy — entrypoint refreshes /preview-gateway.cjs from here (avoids stale embedded heredoc).
COPY preview-gateway.cjs /usr/local/share/sv-preview-gateway.cjs
COPY preview-patch-frontend-safe-map.cjs /preview-patch-frontend-safe-map.cjs
COPY preview-fallback /preview-fallback
RUN sed -i 's/\r$//' /preview-entrypoint.sh && chmod +x /preview-entrypoint.sh /preview-seed-admin.js /preview-seed-mysql.js /preview-mysql-bootstrap.js /preview-verify-login.js /preview-login-fallback.js /preview-safety.cjs /preview-ensure-inject.cjs /preview-gateway.cjs /usr/local/share/sv-preview-gateway.cjs /preview-patch-frontend-safe-map.cjs

EXPOSE 3000
ENTRYPOINT ["/preview-entrypoint.sh"]
