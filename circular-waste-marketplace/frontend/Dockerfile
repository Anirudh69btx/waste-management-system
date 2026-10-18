# syntax=docker/dockerfile:1.6
# =============================================================================
# Circular Waste Marketplace — Frontend Dockerfile
# =============================================================================
# Stages:
#   base        — Node 20 Alpine + npm dependencies (shared layer)
#   development — Vite dev server with HMR + polling for WSL2 bind mounts
#   builder     — Production TypeScript compile + Vite bundle
#   production  — Nginx Alpine serving /dist
# =============================================================================

FROM node:20-alpine AS base

WORKDIR /app

RUN apk add --no-cache curl

# Layer-cache dependencies separately — they change less than source
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi


# =============================================================================
# development stage — used by docker-compose dev workflow
# =============================================================================
FROM base AS development

ENV CHOKIDAR_USEPOLLING=true
ENV NODE_ENV=development

# Source is bind-mounted in docker-compose; COPY here for standalone builds
COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]


# =============================================================================
# builder stage — compile TypeScript and bundle assets
# =============================================================================
FROM base AS builder

COPY . .
RUN npm run build


# =============================================================================
# production stage — Nginx serving pre-built static files
# =============================================================================
FROM nginx:1.27-alpine AS production

RUN apk add --no-cache curl

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
