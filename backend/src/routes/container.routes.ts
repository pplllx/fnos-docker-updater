import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/database';
import { DockerService } from '../services/docker.service';
import { sseManager } from '../utils/sse';

export async function containerRoutes(fastify: FastifyInstance) {
  // All container routes require authentication (unless passwordless)
  fastify.addHook('preHandler', fastify.authenticate);

  // List all containers
  fastify.get('/', async () => {
    const list = await DockerService.listContainers();
    return { data: list };
  });

  // Check update for single container
  fastify.post('/:id/check', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const result = await DockerService.checkContainerUpdate(req.params.id);
      return result;
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Batch check updates for all containers
  fastify.post('/check-all', async () => {
    const list = await DockerService.listContainers();
    const results: Record<string, any> = {};

    for (const c of list) {
      if (c.isIgnored || c.isPinned) continue;
      try {
        const res = await DockerService.checkContainerUpdate(c.id);
        results[c.id] = res;
      } catch (err: any) {
        results[c.id] = { error: err.message };
      }
    }

    return { data: results };
  });

  // Trigger container update with rollback protection
  fastify.post('/:id/update', async (req: FastifyRequest<{
    Params: { id: string };
    Body: { sessionId: string };
  }>, reply: FastifyReply) => {
    const { id } = req.params;
    const { sessionId } = req.body || { sessionId: `update-${Date.now()}` };

    // Run async in background while streaming logs
    DockerService.updateContainer(id, sessionId)
      .then(() => {
        sseManager.emitStatus(sessionId, 'completed', 100);
      })
      .catch((err) => {
        sseManager.emitStatus(sessionId, 'failed', 0);
      });

    return { sessionId, message: '升级任务已启动，请通过实时日志查看进度' };
  });

  // Toggle ignore update for container
  fastify.post('/:id/toggle-ignore', async (req: FastifyRequest<{ Params: { id: string } }>) => {
    const { id } = req.params;
    const row = db.prepare('SELECT is_ignored FROM containers_meta WHERE id = ?').get(id) as any;
    const newStatus = row && row.is_ignored ? 0 : 1;

    db.prepare(`
      INSERT INTO containers_meta (id, name, is_ignored)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET is_ignored = ?
    `).run(id, id.substring(0, 12), newStatus, newStatus);

    return { id, isIgnored: !!newStatus };
  });

  // Toggle pin version for container
  fastify.post('/:id/toggle-pin', async (req: FastifyRequest<{ Params: { id: string } }>) => {
    const { id } = req.params;
    const row = db.prepare('SELECT is_pinned FROM containers_meta WHERE id = ?').get(id) as any;
    const newStatus = row && row.is_pinned ? 0 : 1;

    db.prepare(`
      INSERT INTO containers_meta (id, name, is_pinned)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET is_pinned = ?
    `).run(id, id.substring(0, 12), newStatus, newStatus);

    return { id, isPinned: !!newStatus };
  });
}
