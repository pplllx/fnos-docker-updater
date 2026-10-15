# ==========================================
# Stage 1: Build Frontend (Vue 3 + Vite)
# ==========================================
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Build Backend (Fastify + TS)
# ==========================================
FROM node:22-alpine AS backend-builder
WORKDIR /app/backend

RUN apk add --no-cache python3 make g++

COPY backend/package.json ./
RUN npm install

COPY backend/ ./
RUN npm run build

# Copy built frontend assets into backend dist/public
COPY --from=frontend-builder /app/backend/dist/public ./dist/public

# ==========================================
# Stage 3: Production Runtime
# ==========================================
FROM node:22-alpine AS runner
WORKDIR /app

# Install Docker CLI and Docker Compose Plugin on Alpine
RUN apk add --no-cache docker-cli docker-cli-compose tzdata

ENV NODE_ENV=production
ENV PORT=5678
ENV HOST=0.0.0.0
ENV DB_PATH=/data/data.db

WORKDIR /app
COPY backend/package.json ./
RUN apk add --no-cache python3 make g++ \
    && npm install --omit=dev \
    && apk del python3 make g++

COPY --from=backend-builder /app/backend/dist ./dist

# Create persistent data volume
RUN mkdir -p /data

EXPOSE 5678

VOLUME ["/data", "/var/run/docker.sock"]

CMD ["node", "dist/index.js"]
