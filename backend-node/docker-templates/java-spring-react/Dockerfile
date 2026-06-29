FROM eclipse-temurin:17-jdk-jammy

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates maven \
  && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PORT=3000
ENV HOST=0.0.0.0
ENV API_PORT=8080
ENV APP_SUBDIR=.

COPY entrypoint.sh /preview-entrypoint.sh
COPY preview-fallback /preview-fallback
RUN chmod +x /preview-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/preview-entrypoint.sh"]
