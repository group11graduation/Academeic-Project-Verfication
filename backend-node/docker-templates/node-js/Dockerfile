FROM node:20-alpine

WORKDIR /app

ENV PORT=3000
ENV HOST=0.0.0.0
ENV APP_SUBDIR=.

# Student project is bind-mounted at /app at container start — not baked into the image.
COPY entrypoint.sh /preview-entrypoint.sh
COPY preview-fallback /preview-fallback
RUN chmod +x /preview-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/preview-entrypoint.sh"]
