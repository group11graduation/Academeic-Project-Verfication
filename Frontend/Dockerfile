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
# Required at preview runtime: /api proxy → INTERNAL_API_URL (node-backend)
COPY vite.config.js ./vite.config.js
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV HOST=0.0.0.0
ENV PORT=4173
# Leave empty so the browser uses same-origin /api via Vite proxy
ENV PUBLIC_API_URL=
ENV FORCE_PUBLIC_API_URL=
ENV INTERNAL_API_URL=http://node-backend:5000
EXPOSE 4173

ENTRYPOINT ["/docker-entrypoint.sh"]
