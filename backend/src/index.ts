import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { initDatabase, getSetting } from './db/database';
import { CronService } from './services/cron.service';
import { authRoutes } from './routes/auth.routes';
import { containerRoutes } from './routes/container.routes';
import { composeRoutes } from './routes/compose.routes';
import { systemRoutes } from './routes/system.routes';
import { sseRoutes } from './routes/sse.routes';

dotenv.config();

// Declare Fastify JWT types
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info'
  }
});

async function main() {
  // 1. Initialize SQLite Database
  initDatabase();

  // 2. Register CORS
  await fastify.register(cors, {
    origin: true,
    credentials: true
  });

  // 3. Register JWT
  const jwtSecret = process.env.JWT_SECRET || 'fnos-updater-secret-key-change-in-prod';
  await fastify.register(fastifyJwt, {
    secret: jwtSecret
  });

  // 4. Auth Decorator (supports passwordless mode)
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const passwordless = getSetting<boolean>('passwordless', false);
    if (passwordless) {
      return; // Skip authentication check if passwordless mode is on
    }

    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ error: '未授权或登录已过期，请重新登录' });
    }
  });

  // 5. Register API Routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(containerRoutes, { prefix: '/api/containers' });
  await fastify.register(composeRoutes, { prefix: '/api/compose' });
  await fastify.register(systemRoutes, { prefix: '/api/system' });
  await fastify.register(sseRoutes, { prefix: '/api/sse' });

  // 6. Serve Frontend Static Build (Production & Docker)
  const publicDir = path.resolve(__dirname, 'public');
  if (fs.existsSync(publicDir)) {
    console.log(`[Frontend] Serving static UI from ${publicDir}`);
    await fastify.register(fastifyStatic, {
      root: publicDir,
      prefix: '/'
    });

    // SPA fallback
    fastify.setNotFoundHandler((req, reply) => {
      if (req.raw.url && req.raw.url.startsWith('/api')) {
        reply.status(404).send({ error: 'API endpoint not found' });
      } else {
        reply.sendFile('index.html');
      }
    });
  }

  // 7. Initialize Cron Service
  CronService.init();

  // 8. Start Server
  const PORT = parseInt(process.env.PORT || '5678', 10);
  const HOST = process.env.HOST || '0.0.0.0';

  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`=======================================================`);
    console.log(`🚀 fnOS Docker Updater running on http://${HOST}:${PORT}`);
    console.log(`=======================================================`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
