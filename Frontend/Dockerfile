FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

FROM deps AS build
ARG VITE_API_URL=http://localhost:5000
ENV VITE_API_URL=${VITE_API_URL}
COPY . .
RUN npm run build

FROM base AS release
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./package.json
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV HOST=0.0.0.0
ENV PORT=4173
ENV PUBLIC_API_URL=
EXPOSE 4173

ENTRYPOINT ["/docker-entrypoint.sh"]
