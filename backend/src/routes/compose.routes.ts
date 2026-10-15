import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/database';
import { ComposeService } from '../services/compose.service';
import { sseManager } from '../utils/sse';

export async function composeRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // List all compose projects
  fastify.get('/', async () => {
    const list = await ComposeService.listProjects();
    return { data: list };
  });

  // Get compose file content
  fastify.get('/:name/file', async (req: FastifyRequest<{
    Params: { name: string };
    Querystring: { path: string };
  }>, reply: FastifyReply) => {
    const { path } = req.query;
    try {
      const content = ComposeService.getComposeFileContent(path);
      return { path, content };
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });

  // Save compose file content
  fastify.put('/:name/file', async (req: FastifyRequest<{
    Params: { name: string };
    Body: { path: string; content: string };
  }>, reply: FastifyReply) => {
    const { path, content } = req.body;
    try {
      ComposeService.saveComposeFileContent(path, content);
      return { message: '保存成功，已自动创建历史备份文件' };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Trigger compose project update
  fastify.post('/:name/update', async (req: FastifyRequest<{
    Params: { name: string };
    Body: { path: string; sessionId?: string };
  }>) => {
    const { name } = req.params;
    const { path, sessionId } = req.body;
    const actualSessionId = sessionId || `compose-update-${Date.now()}`;

    ComposeService.updateProject(name, path, actualSessionId)
      .then(() => {
        sseManager.emitStatus(actualSessionId, 'completed', 100);
      })
      .catch((err) => {
        sseManager.emitStatus(actualSessionId, 'failed', 0);
      });

    return { sessionId: actualSessionId, message: 'Compose 升级任务已启动' };
  });

  // Batch check updates for all compose projects
  fastify.post('/check-all', async () => {
    const result = await ComposeService.checkAllProjectsUpdate();
    return { data: result };
  });

  // Check update for single compose project
  fastify.post('/:name/check', async (req: FastifyRequest<{ Params: { name: string } }>, reply: FastifyReply) => {
    try {
      const result = await ComposeService.checkProjectUpdate(req.params.name);
      return result;
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Toggle ignore for compose project
  fastify.post('/:name/toggle-ignore', async (req: FastifyRequest<{ Params: { name: string } }>) => {
    const { name } = req.params;
    const row = db.prepare('SELECT is_ignored FROM compose_projects WHERE name = ?').get(name) as any;
    const newStatus = row && row.is_ignored ? 0 : 1;

    db.prepare(`
      INSERT INTO compose_projects (name, path, is_ignored)
      VALUES (?, '', ?)
      ON CONFLICT(name) DO UPDATE SET is_ignored = ?
    `).run(name, newStatus, newStatus);

    return { name, isIgnored: !!newStatus };
  });
}
