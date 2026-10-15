import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db, getSetting, setSetting } from '../db/database';
import { DockerService } from '../services/docker.service';
import { sseManager } from '../utils/sse';

export async function containerRoutes(fastify: FastifyInstance) {
  // All container routes require authentication (unless passwordless)
  fastify.addHook('preHandler', fastify.authenticate);

  // List all containers
  fastify.get('/', async () => {
    const list = await DockerService.listContainers();
    return {
      data: list,
      dockerConnected: DockerService.isConnected(),
      demoMode: getSetting('demoMode', false)
    };
  });

  // Toggle demo mode
  fastify.post('/toggle-demo', async () => {
    const current = getSetting('demoMode', false);
    const updated = !current;
    setSetting('demoMode', updated);
    return { demoMode: updated };
  });

  // Check update for single container
  fastify.post('/:id/check', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      if (!DockerService.isConnected() && getSetting('demoMode', false)) {
        return { updateAvailable: true, currentDigest: 'sha256:old123', remoteDigest: 'sha256:new456' };
      }
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
        if (!DockerService.isConnected() && getSetting('demoMode', false)) {
          results[c.id] = { updateAvailable: true };
          continue;
        }
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

    if (!DockerService.isConnected() && getSetting('demoMode', false)) {
      // Simulate realistic update over SSE
      setTimeout(async () => {
        sseManager.emitLog(sessionId, `>>> 正在启动容器更新任务: ${id}`, 'info');
        await new Promise(r => setTimeout(r, 400));
        sseManager.emitLog(sessionId, `[Docker] 开始拉取最新镜像数据...`, 'info');
        await new Promise(r => setTimeout(r, 600));
        sseManager.emitLog(sessionId, `[layer-1] Extracting: 100% [====================] 32MB/32MB`, 'info');
        sseManager.emitLog(sessionId, `[layer-2] Pull complete`, 'info');
        await new Promise(r => setTimeout(r, 500));
        sseManager.emitLog(sessionId, `[容灾保护] 停止旧容器并创建临时安全备份: ${id}_backup_${Date.now()}...`, 'info');
        await new Promise(r => setTimeout(r, 500));
        sseManager.emitLog(sessionId, `[重建] 正在使用新镜像重建容器配置...`, 'info');
        await new Promise(r => setTimeout(r, 500));
        sseManager.emitLog(sessionId, `[校验] 验证新容器运行状态...`, 'info');
        await new Promise(r => setTimeout(r, 400));
        sseManager.emitLog(sessionId, `[成功] 新容器运行正常！升级成功。`, 'success');
        sseManager.emitStatus(sessionId, 'completed', 100);

        db.prepare(`
          INSERT INTO update_history (target_type, target_name, status, log_text)
          VALUES ('container', ?, 'success', '升级成功 (演示模式)')
        `).run(id);
      }, 100);

      return { sessionId, message: '升级任务已启动 (演示模式)' };
    }

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
    const row = db.prepare('SELECT id, is_ignored FROM containers_meta WHERE id = ? OR id LIKE ?').get(id, `${id}%`) as any;
    const newStatus = row && row.is_ignored ? 0 : 1;
    const targetId = (row && row.id) ? row.id : id;

    db.prepare(`
      INSERT INTO containers_meta (id, name, is_ignored)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET is_ignored = ?
    `).run(targetId, id.substring(0, 12), newStatus, newStatus);

    return { id, isIgnored: !!newStatus };
  });

  // Toggle pin version for container
  fastify.post('/:id/toggle-pin', async (req: FastifyRequest<{ Params: { id: string } }>) => {
    const { id } = req.params;
    const row = db.prepare('SELECT id, is_pinned FROM containers_meta WHERE id = ? OR id LIKE ?').get(id, `${id}%`) as any;
    const newStatus = row && row.is_pinned ? 0 : 1;
    const targetId = (row && row.id) ? row.id : id;

    db.prepare(`
      INSERT INTO containers_meta (id, name, is_pinned)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET is_pinned = ?
    `).run(targetId, id.substring(0, 12), newStatus, newStatus);

    return { id, isPinned: !!newStatus };
  });
}
