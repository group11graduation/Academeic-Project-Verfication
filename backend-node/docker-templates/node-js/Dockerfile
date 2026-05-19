FROM node:20-alpine

WORKDIR /app

ARG APP_SUBDIR=.
ENV APP_SUBDIR=${APP_SUBDIR}
ENV PORT=3000
ENV HOST=0.0.0.0

# Copy full submission; dependencies install at container start in the correct APP_SUBDIR
COPY . .
COPY entrypoint.sh /preview-entrypoint.sh
RUN chmod +x /preview-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/preview-entrypoint.sh"]
