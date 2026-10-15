# ==========================================
# Stage 1: Build Frontend (Vue 3 + Vite)
# ==========================================
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json ./
RUN npm config set registry https://registry.npmmirror.com && npm install

COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Build Backend (Fastify + TS)
# ==========================================
FROM node:22-alpine AS backend-builder
WORKDIR /app/backend

# 使用阿里云 Alpine 镜像源极速下载依赖
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories \
    && apk add --no-cache python3 make g++

COPY backend/package.json ./
RUN npm config set registry https://registry.npmmirror.com && npm install

COPY backend/ ./
RUN npm run build

# Copy built frontend assets into backend dist/public
COPY --from=frontend-builder /app/backend/dist/public ./dist/public

# ==========================================
# Stage 3: Production Runtime
# ==========================================
FROM node:22-alpine AS runner
WORKDIR /app

# 使用阿里云 Alpine 源极速安装 Docker CLI 与 Compose 插件
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories \
    && apk add --no-cache docker-cli docker-cli-compose tzdata

ENV NODE_ENV=production
ENV PORT=5678
ENV HOST=0.0.0.0
ENV DB_PATH=/data/data.db

# 直接复用 Stage 2 编译好的 node_modules 与产物，避免二次编译
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend/dist ./dist

# Create persistent data volume
RUN mkdir -p /data

EXPOSE 5678

VOLUME ["/data", "/var/run/docker.sock"]

CMD ["node", "dist/index.js"]
