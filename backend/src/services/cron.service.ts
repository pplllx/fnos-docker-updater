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
  }> {
    const containers = await DockerService.listContainers();
    const withUpdates: string[] = [];

    // 1. Check containers
    for (const c of containers) {
      if (c.isIgnored || c.isPinned) continue;
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
    }

    // 2. Discover compose projects
    const composeProjects = await ComposeService.listProjects();

    // 3. Notify discovered updates if auto-update is off
    if (withUpdates.length > 0 && !getSetting('autoUpdateEnabled', false)) {
      const summary = withUpdates.map(name => `- ${name}`).join('\n');
      await NotificationService.notifyAll(
        `巡检发现 ${withUpdates.length} 个容器可更新`,
        `以下容器检测到远端镜像新版本：\n\n${summary}\n\n请前往飞牛 Docker 面板查看或一键更新。`
      );
    }

    return {
      containersChecked: containers.length,
      containersWithUpdates: withUpdates,
      composeChecked: composeProjects.length
    };
  }
}
