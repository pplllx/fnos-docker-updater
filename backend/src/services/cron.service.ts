import cron from 'node-cron';
import { db, getSetting } from '../db/database';
import { ComposeService } from './compose.service';
import { DockerService } from './docker.service';
import { NotificationService } from './notification.service';

export class CronService {
  private static task: cron.ScheduledTask | null = null;

  public static init() {
    this.reschedule();
  }

  public static reschedule() {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }

    const enabled = getSetting<boolean>('cronEnabled', true);
    const schedule = getSetting<string>('cronSchedule', '0 3 * * *');

    if (!enabled) {
      console.log('[Cron] 定时任务未开启');
      return;
    }

    if (!cron.validate(schedule)) {
      console.warn(`[Cron] 无效的 Cron 表达式: ${schedule}`);
      return;
    }

    console.log(`[Cron] 启动定时巡检任务，周期: ${schedule}`);
    this.task = cron.schedule(schedule, async () => {
      console.log('[Cron] 开始执行容器与 Compose 镜像更新巡检...');
      try {
        await this.runInspection();
      } catch (err: any) {
        console.error('[Cron] 巡检过程出现异常:', err.message);
      }
    });
  }

  public static async runInspection(): Promise<{
    containersChecked: number;
    containersWithUpdates: string[];
    composeChecked: number;
    composeWithUpdates: string[];
  }> {
    const containers = await DockerService.listContainers();
    const withUpdates: string[] = [];

    // 1. Check containers in parallel batches
    const activeContainers = containers.filter(c => !c.isIgnored && !c.isPinned);
    const BATCH_SIZE = 6;
    for (let i = 0; i < activeContainers.length; i += BATCH_SIZE) {
      const batch = activeContainers.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (c) => {
          try {
            const res = await DockerService.checkContainerUpdate(c.id);
            if (res.updateAvailable) {
              withUpdates.push(c.name);

              // If auto update is enabled, perform auto update
              if (getSetting('autoUpdateEnabled', false) && !c.isCompose) {
                try {
                  const sessionId = `cron-auto-update-${Date.now()}`;
                  await DockerService.updateContainer(c.id, sessionId);
                  await NotificationService.notifyAll(
                    `自动升级成功: ${c.name}`,
                    `容器 ${c.name} 已自动升级至最新镜像！`
                  );
                } catch (autoErr: any) {
                  await NotificationService.notifyAll(
                    `自动升级失败: ${c.name}`,
                    `容器 ${c.name} 自动升级遇到错误并已执行安全回滚: ${autoErr.message}`
                  );
                }
              }
            }
          } catch (e: any) {
            console.warn(`[Cron] 检查容器 ${c.name} 更新失败:`, e.message);
          }
        })
      );
    }

    // 2. Discover and fully inspect all Compose projects
    console.log('[Cron] 开始全量巡检所有 Compose 项目更新...');
    let composeResult = { total: 0, withUpdates: [] as string[] };
    try {
      composeResult = await ComposeService.checkAllProjectsUpdate(6);
      console.log(`[Cron] Compose 项目巡检完成: 发现 ${composeResult.withUpdates.length} 个项目可更新`);
    } catch (e: any) {
      console.warn('[Cron] Compose 巡检异常:', e.message);
    }

    // 3. Notify discovered updates if auto-update is off
    const allCount = withUpdates.length + composeResult.withUpdates.length;
    if (allCount > 0 && !getSetting('autoUpdateEnabled', false)) {
      const composeMsg = composeResult.withUpdates.length > 0
        ? `\n\n📦 可更新 Compose 项目 (${composeResult.withUpdates.length}):\n${composeResult.withUpdates.map(n => `- ${n}`).join('\n')}`
        : '';
      const containerMsg = withUpdates.length > 0
        ? `\n\n🐳 可更新独立容器 (${withUpdates.length}):\n${withUpdates.map(n => `- ${n}`).join('\n')}`
        : '';

      await NotificationService.notifyAll(
        `巡检发现 ${allCount} 个项目/容器可更新`,
        `系统后台自动巡检完成，以下服务检测到远端镜像新版本：${composeMsg}${containerMsg}\n\n请前往飞牛 Docker 面板查看并一键更新。`
      );
    }

    return {
      containersChecked: containers.length,
      containersWithUpdates: withUpdates,
      composeChecked: composeResult.total,
      composeWithUpdates: composeResult.withUpdates
    };
  }
}
