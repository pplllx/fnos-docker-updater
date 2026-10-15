import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db, getSetting, setSetting } from '../db/database';
import { CronService } from '../services/cron.service';
import { DockerService } from '../services/docker.service';
import { NotificationService } from '../services/notification.service';
import { NotificationChannel } from '../types';

export async function systemRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // Get settings
  fastify.get('/settings', async () => {
    return {
      registryMirrors: getSetting<string[]>('registryMirrors', []),
      httpProxy: getSetting<string>('httpProxy', ''),
      cronSchedule: getSetting<string>('cronSchedule', '0 3 * * *'),
      cronEnabled: getSetting<boolean>('cronEnabled', true),
      autoUpdateEnabled: getSetting<boolean>('autoUpdateEnabled', false),
      autoPruneImages: getSetting<boolean>('autoPruneImages', true),
      composeScanPaths: getSetting<string[]>('composeScanPaths', []),
      passwordless: getSetting<boolean>('passwordless', false),
      initialized: getSetting<boolean>('initialized', false)
    };
  });

  // Update settings
  fastify.put('/settings', async (req: FastifyRequest<{
    Body: Record<string, any>;
  }>) => {
    const body = req.body;
    let cronNeedsReschedule = false;

    for (const [key, val] of Object.entries(body)) {
      setSetting(key, val);
      if (key === 'cronSchedule' || key === 'cronEnabled') {
        cronNeedsReschedule = true;
      }
    }

    if (cronNeedsReschedule) {
      CronService.reschedule();
    }

    return { message: '配置已更新' };
  });

  // List notification channels
  fastify.get('/notifications', async () => {
    return { data: NotificationService.getChannels() };
  });

  // Save notification channel
  fastify.post('/notifications', async (req: FastifyRequest<{
    Body: NotificationChannel;
  }>) => {
    NotificationService.saveChannel(req.body);
    return { message: '通知渠道已保存' };
  });

  // Delete notification channel
  fastify.delete('/notifications/:id', async (req: FastifyRequest<{ Params: { id: string } }>) => {
    NotificationService.deleteChannel(req.params.id);
    return { message: '通知渠道已删除' };
  });

  // Test notification
  fastify.post('/notifications/test', async (req: FastifyRequest<{
    Body: { channel: NotificationChannel };
  }>, reply: FastifyReply) => {
    try {
      await NotificationService.sendToChannel(
        req.body.channel,
        '测试通知',
        '这是一条来自飞牛 Docker 更新面板的测试推送，连接配置正确！'
      );
      return { message: '测试消息发送成功' };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Prune unused Docker images
  fastify.post('/prune-images', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const res = await DockerService.pruneImages();
      return { message: '镜像清理完成', data: res };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Update history logs
  fastify.get('/history', async () => {
    const rows = db.prepare('SELECT * FROM update_history ORDER BY id DESC LIMIT 50').all();
    return { data: rows };
  });

  // Trigger manual inspection
  fastify.post('/cron/run-now', async () => {
    const result = await CronService.runInspection();
    return { message: '巡检已完成', result };
  });
}
