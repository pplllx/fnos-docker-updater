import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { db, getSetting, setSetting } from '../db/database';

export async function authRoutes(fastify: FastifyInstance) {
  // Check system initialization status
  fastify.get('/status', async (req: FastifyRequest, reply: FastifyReply) => {
    const initialized = getSetting<boolean>('initialized', false);
    const passwordless = getSetting<boolean>('passwordless', false);
    return { initialized, passwordless };
  });

  // Setup wizard (runs only if not initialized)
  fastify.post('/setup', async (req: FastifyRequest<{
    Body: { username?: string; password?: string; passwordless?: boolean }
  }>, reply: FastifyReply) => {
    const initialized = getSetting<boolean>('initialized', false);
    if (initialized) {
      return reply.status(400).send({ error: '系统已经完成初始化设置' });
    }

    const { username, password, passwordless } = req.body;

    if (passwordless) {
      setSetting('passwordless', true);
      setSetting('initialized', true);
      const token = fastify.jwt.sign({ username: 'admin', role: 'admin' });
      return { token, message: '已开启免密直接访问模式' };
    }

    if (!username || !password || password.length < 6) {
      return reply.status(400).send({ error: '用户名和密码不能为空，且密码长度至少6位' });
    }

    const hash = await bcrypt.hash(password, 10);
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
    setSetting('passwordless', false);
    setSetting('initialized', true);

    const token = fastify.jwt.sign({ username, role: 'admin' });
    return { token, message: '初始化成功' };
  });

  // Login
  fastify.post('/login', async (req: FastifyRequest<{
    Body: { username?: string; password?: string }
  }>, reply: FastifyReply) => {
    const passwordless = getSetting<boolean>('passwordless', false);
    if (passwordless) {
      const token = fastify.jwt.sign({ username: 'admin', role: 'admin' });
      return { token };
    }

    const { username, password } = req.body;
    if (!username || !password) {
      return reply.status(400).send({ error: '请输入用户名和密码' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    if (!user) {
      return reply.status(401).send({ error: '用户名或密码错误' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return reply.status(401).send({ error: '用户名或密码错误' });
    }

    const token = fastify.jwt.sign({ username: user.username, role: 'admin' });
    return { token };
  });

  // Current user info
  fastify.get('/me', {
    preHandler: [fastify.authenticate]
  }, async (req: FastifyRequest) => {
    return { user: req.user };
  });
}
