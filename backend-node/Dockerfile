# Orchestration API — production-oriented image
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM base AS release
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json* ./
COPY src ./src
COPY scripts ./scripts
EXPOSE 5000
USER node
CMD ["node", "src/index.js"]
