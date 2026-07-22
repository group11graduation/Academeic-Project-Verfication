FROM node:20-alpine

WORKDIR /app

ENV PORT=3000
ENV HOST=0.0.0.0
ENV APP_SUBDIR=.

# Static placeholder + built dist folders — avoid npx download on every preview start.
RUN npm install -g serve@14.2.4

# Student project is bind-mounted at /app at container start — not baked into the image.
COPY entrypoint.sh /preview-entrypoint.sh
COPY preview-seed-admin.js /preview-seed-admin.js
COPY preview-verify-login.js /preview-verify-login.js
COPY preview-login-fallback.js /preview-login-fallback.js
COPY preview-fallback /preview-fallback
RUN sed -i 's/\r$//' /preview-entrypoint.sh && chmod +x /preview-entrypoint.sh /preview-seed-admin.js /preview-verify-login.js /preview-login-fallback.js

EXPOSE 3000
ENTRYPOINT ["/preview-entrypoint.sh"]
