import Docker from 'dockerode';
import fs from 'fs';
import { db, getSetting } from '../db/database';
import { ContainerItem } from '../types';
import { sseManager } from '../utils/sse';
import { RegistryService } from './registry.service';

function getDockerInstance(): Docker | null {
  const socketPath = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
  try {
    if (fs.existsSync(socketPath)) {
      return new Docker({ socketPath });
    }
    if (process.env.DOCKER_HOST) {
      return new Docker();
    }
  } catch (e) {
    console.warn(`[Docker] Cannot access socket at ${socketPath}`);
  }
  return null;
}

export const docker = getDockerInstance();

export class DockerService {
  public static isConnected(): boolean {
    return docker !== null;
  }

  public static async ping(): Promise<boolean> {
    if (!docker) return false;
    try {
      await docker.ping();
      return true;
    } catch {
      return false;
    }
  }

  public static async listContainers(): Promise<ContainerItem[]> {
    if (!docker) {
      if (getSetting('demoMode', false)) {
        return this.getDemoContainers();
      }
      return [];
    }

    const rawList = await docker.listContainers({ all: true });
    const items: ContainerItem[] = [];

    // Pre-fetch metadata from sqlite
    const metaRows = db.prepare('SELECT * FROM containers_meta').all() as any[];
    const metaMap = new Map<string, any>();
    metaRows.forEach(r => metaMap.set(r.id, r));

    for (const c of rawList) {
      const id = c.Id;
      const rawName = (c.Names && c.Names[0]) || id.substring(0, 12);
      const name = rawName.startsWith('/') ? rawName.slice(1) : rawName;
      const isCompose = !!(c.Labels && c.Labels['com.docker.compose.project']);
      const composeProject = c.Labels ? c.Labels['com.docker.compose.project'] : undefined;
      const composeFile = c.Labels ? c.Labels['com.docker.compose.project.config_files'] : undefined;

      const ports: string[] = [];
      if (c.Ports) {
        c.Ports.forEach(p => {
          if (p.PublicPort) {
            ports.push(`${p.PublicPort}:${p.PrivatePort}/${p.Type}`);
          } else {
            ports.push(`${p.PrivatePort}/${p.Type}`);
          }
        });
      }

      const meta = metaMap.get(id);

      // Parse image & tag
      let image = c.Image;
      let tag = 'latest';
      if (image.includes(':')) {
        const parts = image.split(':');
        tag = parts.pop()!;
        image = parts.join(':');
      }

      items.push({
        id,
        name,
        image,
        imageId: c.ImageID,
        tag,
        status: c.Status,
        state: c.State,
        created: c.Created,
        isCompose,
        composeProject,
        composeFile,
        ports,
        currentDigest: meta?.last_remote_digest || undefined,
        remoteDigest: meta?.last_remote_digest || undefined,
        updateAvailable: meta ? !!meta.update_available : false,
        isIgnored: meta ? !!meta.is_ignored : false,
        isPinned: meta ? !!meta.is_pinned : false,
        lastCheckedAt: meta?.last_checked_at || undefined
      });
    }

    return items;
  }

  /**
   * Check update for a single container
   */
  public static async checkContainerUpdate(containerId: string): Promise<{ updateAvailable: boolean; currentDigest?: string; remoteDigest?: string }> {
    if (!docker) throw new Error('Docker daemon not connected');

    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    const imageName = info.Config.Image;

    // Gather all local digests: Image ID, RepoDigests
    const localDigests = new Set<string>();
    let currentDigest = '';
    try {
      const imageInfo = await docker.getImage(info.Image).inspect();
      if (imageInfo.Id) {
        currentDigest = imageInfo.Id;
        localDigests.add(imageInfo.Id.trim().toLowerCase());
        localDigests.add(imageInfo.Id.replace(/^sha256:/, '').trim().toLowerCase());
      }
      if (imageInfo.RepoDigests && imageInfo.RepoDigests.length > 0) {
        for (const rd of imageInfo.RepoDigests) {
          const split = rd.split('@');
          const d = (split.length > 1 ? split[1] : split[0]).trim().toLowerCase();
          if (!currentDigest) currentDigest = d;
          localDigests.add(d);
          localDigests.add(d.replace(/^sha256:/, ''));
        }
      }
    } catch (e) {
      currentDigest = info.Image;
    }

    // Query remote digest from Registry
    const remoteInfo = await RegistryService.getRemoteDigestInfo(imageName);
    let updateAvailable = false;
    let remoteDigest = '';

    if (remoteInfo) {
      remoteDigest = remoteInfo.digest;
      // Check if ANY of the remote digests (index, platform, or config digest) match local image digests
      const isUpToDate = remoteInfo.allDigests.some(rd => {
        const clean = rd.trim().toLowerCase();
        return localDigests.has(clean) || localDigests.has(clean.replace(/^sha256:/, ''));
      });
      updateAvailable = !isUpToDate;
    }

    // Save check result to database
    db.prepare(`
      INSERT INTO containers_meta (id, name, last_checked_at, last_remote_digest, update_available)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        last_checked_at = CURRENT_TIMESTAMP,
        last_remote_digest = ?,
        update_available = ?
    `).run(
      containerId,
      info.Name.replace(/^\//, ''),
      remoteDigest || '',
      updateAvailable ? 1 : 0,
      remoteDigest || '',
      updateAvailable ? 1 : 0
    );

    return { updateAvailable, currentDigest, remoteDigest: remoteDigest || undefined };
  }

  /**
   * Pull image with progress tracking and streaming to SSE
   */
  public static async pullImageWithProgress(imageName: string, sessionId: string): Promise<void> {
    if (!docker) throw new Error('Docker daemon not connected');

    sseManager.emitLog(sessionId, `[Docker] 开始拉取最新镜像: ${imageName}...`, 'info');

    return new Promise((resolve, reject) => {
      docker!.pull(imageName, (err: any, stream: any) => {
        if (err) {
          sseManager.emitLog(sessionId, `[Docker] 拉取失败: ${err.message}`, 'error');
          return reject(err);
        }

        docker!.modem.followProgress(
          stream,
          (finishErr: any, output: any[]) => {
            if (finishErr) {
              sseManager.emitLog(sessionId, `[Docker] 镜像流解析错误: ${finishErr.message}`, 'error');
              return reject(finishErr);
            }
            sseManager.emitLog(sessionId, `[Docker] 镜像拉取完成: ${imageName}`, 'success');
            resolve();
          },
          (event: any) => {
            if (event.status) {
              const idStr = event.id ? `[${event.id}] ` : '';
              const progressStr = event.progress ? ` ${event.progress}` : '';
              sseManager.emitLog(sessionId, `${idStr}${event.status}${progressStr}`, 'info');
            }
          }
        );
      });
    });
  }

  /**
   * Recreates a single container with rollback support
   */
  public static async updateContainer(containerId: string, sessionId: string): Promise<void> {
    if (!docker) throw new Error('Docker daemon not connected');

    const container = docker.getContainer(containerId);
    const oldInfo = await container.inspect();
    const originalName = oldInfo.Name.replace(/^\//, '');
    const imageName = oldInfo.Config.Image;
    const backupName = `${originalName}_fn_backup_${Date.now()}`;

    sseManager.emitLog(sessionId, `>>> 正在启动容器更新任务: ${originalName} (ID: ${containerId.substring(0, 12)})`, 'info');

    // Step 1: Pull new image
    await this.pullImageWithProgress(imageName, sessionId);

    // Step 2: Stop old container and rename to backup
    sseManager.emitLog(sessionId, `[容灾保护] 停止旧容器并创建临时安全备份: ${backupName}...`, 'info');
    try {
      if (oldInfo.State.Running) {
        await container.stop({ t: 10 });
      }
      await container.rename({ name: backupName });
    } catch (err: any) {
      sseManager.emitLog(sessionId, `[容灾保护] 备份旧容器失败: ${err.message}`, 'error');
      throw err;
    }

    // Step 3: Create new container with exact same configuration
    let newContainer: Docker.Container | null = null;
    try {
      sseManager.emitLog(sessionId, `[重建] 正在使用新镜像重建容器配置...`, 'info');
      
      const createOptions: Docker.ContainerCreateOptions = {
        name: originalName,
        Image: imageName,
        Env: oldInfo.Config.Env,
        Cmd: oldInfo.Config.Cmd,
        Entrypoint: oldInfo.Config.Entrypoint,
        WorkingDir: oldInfo.Config.WorkingDir,
        Labels: oldInfo.Config.Labels,
        ExposedPorts: oldInfo.Config.ExposedPorts,
        HostConfig: oldInfo.HostConfig,
        NetworkingConfig: {
          EndpointsConfig: oldInfo.NetworkSettings.Networks
        }
      };

      newContainer = await docker.createContainer(createOptions);
      sseManager.emitLog(sessionId, `[启动] 正在启动新容器...`, 'info');
      await newContainer.start();

      // Step 4: Healthcheck / wait 3s to verify container stays up
      sseManager.emitLog(sessionId, `[校验] 验证新容器运行状态...`, 'info');
      await new Promise(r => setTimeout(r, 3000));
      const newStatus = await newContainer.inspect();

      if (!newStatus.State.Running) {
        throw new Error(`新容器未能持续保持运行 (ExitCode: ${newStatus.State.ExitCode})`);
      }

      sseManager.emitLog(sessionId, `[成功] 新容器运行正常！升级成功。`, 'success');

      // Step 5: Clean backup container
      try {
        sseManager.emitLog(sessionId, `[清理] 正在清理临时安全备份容器...`, 'info');
        await container.remove({ force: true });
      } catch (cleanErr: any) {
        sseManager.emitLog(sessionId, `[警告] 清理临时备份失败: ${cleanErr.message}`, 'warn');
      }

      // Step 6: Prune old images if enabled
      if (getSetting('autoPruneImages', true)) {
        try {
          await docker.pruneImages({ filters: { dangling: { false: false, true: true } } });
        } catch {}
      }

      // Reset update_available flag in DB
      db.prepare('UPDATE containers_meta SET update_available = 0 WHERE id = ?').run(containerId);

      // Record update history
      db.prepare(`
        INSERT INTO update_history (target_type, target_name, status, log_text)
        VALUES ('container', ?, 'success', '升级成功')
      `).run(originalName);

    } catch (recreateErr: any) {
      // Step 7: TRIGGER ROLLBACK!
      sseManager.emitLog(sessionId, `[警告] 新容器启动异常: ${recreateErr.message}`, 'error');
      sseManager.emitLog(sessionId, `[容灾回滚] 正在紧急回退到旧版本备份容器...`, 'warn');

      try {
        if (newContainer) {
          try {
            await newContainer.stop({ t: 2 });
            await newContainer.remove({ force: true });
          } catch {}
        }
        // Restore backup container
        await container.rename({ name: originalName });
        if (oldInfo.State.Running) {
          await container.start();
        }
        sseManager.emitLog(sessionId, `[容灾回滚] 已成功回滚至原备份版本！服务已恢复。`, 'success');
      } catch (rollbackErr: any) {
        sseManager.emitLog(sessionId, `[致命] 自动回滚遇到问题: ${rollbackErr.message}，请前往终端手动检查！`, 'error');
      }

      db.prepare(`
        INSERT INTO update_history (target_type, target_name, status, log_text)
        VALUES ('container', ?, 'rolled_back', ?)
      `).run(originalName, recreateErr.message);

      throw recreateErr;
    }
  }

  public static async pruneImages(): Promise<any> {
    if (!docker) {
      if (getSetting('demoMode', false)) {
        return { ImagesDeleted: [{ Deleted: 'sha256:mock123' }], SpaceReclaimed: 450000000 };
      }
      throw new Error('Docker daemon not connected');
    }
    return await docker.pruneImages();
  }

  public static getDemoContainers(): ContainerItem[] {
    const metaRows = db.prepare('SELECT * FROM containers_meta').all() as any[];
    const metaMap = new Map<string, any>();
    metaRows.forEach(r => metaMap.set(r.id, r));

    const demos: ContainerItem[] = [
      {
        id: 'demo-c1-vaultwarden',
        name: 'vaultwarden',
        image: 'vaultwarden/server',
        imageId: 'sha256:1a2b3c4d5e',
        tag: 'latest',
        status: 'Up 3 days (healthy)',
        state: 'running',
        created: Math.floor(Date.now() / 1000) - 259200,
        isCompose: false,
        ports: ['8080:80/tcp'],
        updateAvailable: true,
        isIgnored: false,
        isPinned: false,
        lastCheckedAt: new Date().toISOString()
      },
      {
        id: 'demo-c2-homeassistant',
        name: 'home-assistant',
        image: 'ghcr.io/home-assistant/home-assistant',
        imageId: 'sha256:2b3c4d5e6f',
        tag: '2024.10.2',
        status: 'Up 5 hours',
        state: 'running',
        created: Math.floor(Date.now() / 1000) - 18000,
        isCompose: false,
        ports: ['8123:8123/tcp'],
        updateAvailable: false,
        isIgnored: false,
        isPinned: false,
        lastCheckedAt: new Date().toISOString()
      },
      {
        id: 'demo-c3-qbittorrent',
        name: 'qbittorrent-nox',
        image: 'linuxserver/qbittorrent',
        imageId: 'sha256:3c4d5e6f7a',
        tag: 'latest',
        status: 'Up 12 days',
        state: 'running',
        created: Math.floor(Date.now() / 1000) - 1036800,
        isCompose: true,
        composeProject: 'downloader',
        composeFile: '/vol1/1000/docker/downloader/docker-compose.yml',
        ports: ['8085:8080/tcp', '6881:6881/tcp'],
        updateAvailable: true,
        isIgnored: false,
        isPinned: false,
        lastCheckedAt: new Date().toISOString()
      },
      {
        id: 'demo-c4-emby',
        name: 'emby-server',
        image: 'emby/embyserver',
        imageId: 'sha256:4d5e6f7a8b',
        tag: '4.8.10.0',
        status: 'Up 2 days',
        state: 'running',
        created: Math.floor(Date.now() / 1000) - 172800,
        isCompose: false,
        ports: ['8096:8096/tcp'],
        updateAvailable: false,
        isIgnored: false,
        isPinned: true,
        lastCheckedAt: new Date().toISOString()
      },
      {
        id: 'demo-c5-nginx',
        name: 'nginx-gateway',
        image: 'nginx',
        imageId: 'sha256:5e6f7a8b9c',
        tag: 'alpine',
        status: 'Up 8 days',
        state: 'running',
        created: Math.floor(Date.now() / 1000) - 691200,
        isCompose: true,
        composeProject: 'gateway',
        composeFile: '/vol1/1000/docker/gateway/compose.yaml',
        ports: ['80:80/tcp', '443:443/tcp'],
        updateAvailable: false,
        isIgnored: false,
        isPinned: false,
        lastCheckedAt: new Date().toISOString()
      }
    ];

    demos.forEach(d => {
      const meta = metaMap.get(d.id);
      if (meta) {
        if (meta.is_ignored !== undefined) d.isIgnored = !!meta.is_ignored;
        if (meta.is_pinned !== undefined) d.isPinned = !!meta.is_pinned;
        if (meta.update_available !== undefined) d.updateAvailable = !!meta.update_available;
      }
    });

    return demos;
  }
}

