FROM ghcr.io/cirruslabs/flutter:stable AS flutter-sdk

FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git unzip xz-utils \
    && rm -rf /var/lib/apt/lists/*

COPY --from=flutter-sdk /sdks/flutter /opt/flutter
ENV FLUTTER_ROOT=/opt/flutter
ENV PATH="/opt/flutter/bin:${PATH}"

WORKDIR /app

ENV PORT=3000
ENV HOST=0.0.0.0
ENV APP_SUBDIR=.

COPY entrypoint.sh /preview-entrypoint.sh
COPY preview-fallback /preview-fallback
RUN chmod +x /preview-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/preview-entrypoint.sh"]
