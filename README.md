# fnOS Docker Updater - 飞牛 Docker / Compose 现代化更新面板

一款专为飞牛 NAS（fnOS）及 Linux NAS 打造的轻量级 Docker 与 Docker Compose 自动/手动更新管理面板。

---

## ✨ 核心特性

- **🐳 双模全面支持**：同时支持独立 Docker 容器（`docker run`）与 Docker Compose 项目的生命周期与更新管理。
- **⚡ 超轻量 Registry V2 远程检测**：基于 Docker Registry HTTP API V2 远程检索 Tag 的最新 Digest，对比本地容器镜像哈希。**无需预先拉取庞大的镜像层**，极度节省 NAS 带宽与磁盘空间。
- **🚀 飞牛网络与镜像加速深度适配**：支持自定义配置国内 Docker 镜像加速源（DaoCloud / 镜像代理）及 HTTP/HTTPS 网络代理，轻松解决 GitHub Container Registry (ghcr.io) 与 Docker Hub 在国内的拉取超时问题。
- **🛡️ 独创单容器容灾保护与自动回滚**：更新单容器时自动重命名保留旧版本容器作为安全备份；如新版本出现配置不兼容、启动失败或闪退，**秒级自动回退至旧版本备份容器**，确保业务服务零中断。
- **📁 飞牛存储卷 Compose 自动发现**：自动解析正在运行容器的 `com.docker.compose.*` 标签，并支持递归扫描飞牛存储路径（如 `/vol1/1000/docker`），停机的项目也能轻松管理。
- **📝 在线 Compose 配置查看与修改**：无需进终端 SSH，面板内直接查看与编辑 `docker-compose.yml`，修改保存时自动生成 `.bak` 历史备份。
- **📺 实时终端日志推流 (SSE)**：拉取镜像与重建编排过程采用 Server-Sent Events (SSE) 实时推流至前端终端控制台，下载层进度与报错一目了然。
- **⏰ 定时全自动巡检与批量升级**：支持自定义 Cron 定时巡检，可自由设置“仅通知”或“自动拉取升级+自动清理旧镜像”。
- **📣 全渠道消息推送**：支持企业微信机器人、钉钉、飞书、Bark (iOS)、Telegram Bot 及自定义 Webhook，新版本与升级状态第一时间推送到手。
- **🔒 安全与免密访问**：支持首次向导设置管理员密码与 JWT 鉴权，支持一键切换内网免密模式。

---

## 🚀 飞牛 NAS 极速部署 (Docker Compose)

在飞牛 NAS 的“Docker 编排”或终端中创建 `docker-compose.yml`：

```yaml
services:
  fnos-docker-updater:
    image: pengpenglu/fnos-docker-updater:latest
    container_name: fnos-docker-updater
    restart: unless-stopped
    ports:
      - "5678:5678"
    volumes:
      # 挂载宿主机 Docker Socket 以管理容器
      - /var/run/docker.sock:/var/run/docker.sock
      # 挂载 SQLite 数据库持久化目录
      - ./data:/data
      # 挂载飞牛 NAS 存储卷（用于自动扫描 Compose 项目，根据实际卷调整）
      - /vol1:/vol1
    environment:
      - TZ=Asia/Shanghai
      - PORT=5678
      - HOST=0.0.0.0
      - JWT_SECRET=fnos-updater-secure-secret-please-change
```

启动命令：
```bash
docker compose up -d
```

启动完成后，在浏览器访问 `http://<飞牛NAS的IP>:5678` 即可进入面板。

---

## 🛠️ 本地开发与构建

### 1. 技术栈
- **后端**：Node.js + Fastify + TypeScript + Dockerode + Better-SQLite3 + Execa + Node-Cron
- **前端**：Vue 3 + Vite + TypeScript + Pinia + Element Plus + Tailwind CSS

### 2. 启动开发模式
```bash
# 安装依赖
npm install

# 启动后端开发服务 (端口 5678)
npm run dev:backend

# 启动前端开发服务 (端口 5173，自动反向代理 API 至 5678)
npm run dev:frontend
```

### 3. 构建单镜像打包
```bash
# 全量构建
npm run build

# Docker 镜像打包
docker build -t fnos-docker-updater:latest .
```

---

## 📄 开源许可证
本项目采用 MIT 许可证开源。
