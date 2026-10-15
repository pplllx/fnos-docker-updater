import fs from 'fs';
import path from 'path';
import { execa } from 'execa';
import { db, getSetting } from '../db/database';
import { ComposeProjectItem } from '../types';
import { sseManager } from '../utils/sse';
import { docker, DockerService } from './docker.service';

export class ComposeService {
  /**
   * Find compose CLI binary: prefers `docker compose`, falls back to `docker-compose`
   */
  public static async getComposeCommand(): Promise<{ bin: string; argsPrefix: string[] }> {
    try {
      await execa('docker', ['compose', 'version']);
      return { bin: 'docker', argsPrefix: ['compose'] };
    } catch {
      try {
        await execa('docker-compose', ['version']);
        return { bin: 'docker-compose', argsPrefix: [] };
      } catch {
        // Fallback to docker compose inside container
        return { bin: 'docker', argsPrefix: ['compose'] };
      }
    }
  }

  /**
   * Discovers all Compose projects: combining Docker container labels + filesystem scan
   */
  public static async listProjects(): Promise<ComposeProjectItem[]> {
    const projectsMap = new Map<string, ComposeProjectItem>();

    // Query container metadata to aggregate update statuses from underlying containers
    const containerMetaRows = db.prepare('SELECT id, name, update_available, last_checked_at FROM containers_meta').all() as any[];
    const containerMetaMap = new Map<string, any>();
    containerMetaRows.forEach(r => {
      if (r.id) {
        containerMetaMap.set(r.id, r);
        containerMetaMap.set(r.id.slice(0, 12), r);
      }
      if (r.name) {
        containerMetaMap.set(r.name.replace(/^\//, ''), r);
      }
    });

    // 1. Discover from active/existing Docker containers
    if (docker) {
      try {
        const containers = await docker.listContainers({ all: true });
        for (const c of containers) {
          const project = c.Labels ? c.Labels['com.docker.compose.project'] : null;
          const configFile = c.Labels ? c.Labels['com.docker.compose.project.config_files'] : null;
          const service = c.Labels ? c.Labels['com.docker.compose.service'] : null;

          if (project) {
            let item = projectsMap.get(project);
            if (!item) {
              item = {
                name: project,
                path: configFile || '',
                services: [],
                status: 'stopped',
                containers: [],
                updateAvailable: false,
                updatedServices: [],
                updateCount: 0,
                isIgnored: false
              };
              projectsMap.set(project, item);
            }

            if (service && !item.services.includes(service)) {
              item.services.push(service);
            }
            const rawName = (c.Names && c.Names[0]) || c.Id;
            const cleanName = rawName.replace(/^\//, '');
            item.containers.push(cleanName);

            if (c.State === 'running') {
              item.status = item.status === 'stopped' ? 'partially_running' : 'running';
            }

            // Aggregate update status from container metadata
            const cMeta = containerMetaMap.get(c.Id) || 
                          containerMetaMap.get(c.Id.slice(0, 12)) || 
                          containerMetaMap.get(cleanName);
            if (cMeta && cMeta.update_available) {
              item.updateAvailable = true;
              if (service && item.updatedServices && !item.updatedServices.includes(service)) {
                item.updatedServices.push(service);
              }
              if (cMeta.last_checked_at && (!item.lastCheckedAt || cMeta.last_checked_at > item.lastCheckedAt)) {
                item.lastCheckedAt = cMeta.last_checked_at;
              }
            }
          }
        }
      } catch (e) {
        console.warn('[Compose] Failed to query Docker labels for compose projects', e);
      }
    }

    // 2. Discover from scanned filesystem directories
    const scanPaths = getSetting<string[]>('composeScanPaths', []);
    for (const scanDir of scanPaths) {
      if (fs.existsSync(scanDir)) {
        this.scanDirectoryForCompose(scanDir, 2, projectsMap);
      }
    }

    // 2.5 Demo mode fallback if empty and demo mode is active
    if (projectsMap.size === 0 && getSetting('demoMode', false)) {
      projectsMap.set('downloader', {
        name: 'downloader',
        path: '/vol1/1000/docker/downloader/docker-compose.yml',
        services: ['qbittorrent', 'aria2', 'gluetun'],
        status: 'running',
        containers: ['downloader-qbittorrent-1', 'downloader-aria2-1'],
        updateAvailable: true,
        updatedServices: ['qbittorrent'],
        updateCount: 1,
        isIgnored: false,
        lastCheckedAt: new Date().toISOString()
      });
      projectsMap.set('gateway', {
        name: 'gateway',
        path: '/vol1/1000/docker/gateway/compose.yaml',
        services: ['nginx', 'certbot'],
        status: 'running',
        containers: ['gateway-nginx-1', 'gateway-certbot-1'],
        updateAvailable: false,
        updatedServices: [],
        updateCount: 0,
        isIgnored: false,
        lastCheckedAt: new Date().toISOString()
      });
    }

    // 3. Merge database metadata
    const metaRows = db.prepare('SELECT * FROM compose_projects').all() as any[];
    const metaMap = new Map<string, any>();
    metaRows.forEach(r => metaMap.set(r.name, r));

    const result: ComposeProjectItem[] = [];
    for (const [name, item] of projectsMap.entries()) {
      const meta = metaMap.get(name);
      if (meta) {
        item.isIgnored = !!meta.is_ignored;
        // Authority check: if project was explicitly updated or checked to be up-to-date
        if (meta.update_available === 0) {
          item.updateAvailable = false;
          item.updatedServices = [];
        } else if (meta.update_available === 1) {
          item.updateAvailable = true;
        }
        if (meta.last_checked_at && (!item.lastCheckedAt || meta.last_checked_at > item.lastCheckedAt)) {
          item.lastCheckedAt = meta.last_checked_at;
        }
      }
      if (!item.updatedServices) {
        item.updatedServices = [];
      }
      item.updateCount = item.updatedServices.length || (item.updateAvailable ? 1 : 0);
      result.push(item);
    }

    return result;
  }

  private static scanDirectoryForCompose(
    currentDir: string,
    depth: number,
    projectsMap: Map<string, ComposeProjectItem>
  ) {
    if (depth < 0) return;
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      const composeNames = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];

      let foundComposeFile: string | null = null;
      for (const name of composeNames) {
        const full = path.join(currentDir, name);
        if (fs.existsSync(full)) {
          foundComposeFile = full;
          break;
        }
      }

      if (foundComposeFile) {
        const projectName = path.basename(currentDir);
        if (!projectsMap.has(projectName)) {
          projectsMap.set(projectName, {
            name: projectName,
            path: foundComposeFile,
            services: [],
            status: 'stopped',
            containers: [],
            updateAvailable: false,
            updatedServices: [],
            updateCount: 0,
            isIgnored: false
          });
        }
      }

      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          this.scanDirectoryForCompose(path.join(currentDir, entry.name), depth - 1, projectsMap);
        }
      }
    } catch {
      // permission error or directory not accessible
    }
  }

  /**
   * Read compose file content
   */
  public static getComposeFileContent(filePath: string): string {
    if (!fs.existsSync(filePath)) {
      if (getSetting('demoMode', false)) {
        return `services:\n  qbittorrent:\n    image: linuxserver/qbittorrent:latest\n    container_name: qbittorrent\n    environment:\n      - PUID=1000\n      - PGID=1000\n      - TZ=Asia/Shanghai\n    volumes:\n      - /vol1/1000/docker/qbittorrent/config:/config\n      - /vol1/1000/downloads:/downloads\n    ports:\n      - 8085:8080\n      - 6881:6881\n    restart: unless-stopped\n`;
      }
      throw new Error(`Compose file does not exist: ${filePath}`);
    }
    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * Save compose file content (with auto backup)
   */
  public static saveComposeFileContent(filePath: string, content: string): void {
    if (fs.existsSync(filePath)) {
      const backupPath = `${filePath}.bak_${Date.now()}`;
      fs.copyFileSync(filePath, backupPath);
    }
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * Update compose project: pull & up -d with live SSE log streaming
   */
  public static async updateProject(projectName: string, filePath: string, sessionId: string): Promise<void> {
    const { bin, argsPrefix } = await this.getComposeCommand();

    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`找不到有效的 compose 文件路径: ${filePath}`);
    }

    const workingDir = path.dirname(filePath);
    sseManager.emitLog(sessionId, `>>> 开始更新 Compose 项目: ${projectName}`, 'info');
    sseManager.emitLog(sessionId, `工作目录: ${workingDir}, 文件: ${filePath}`, 'info');

    // Step 1: docker compose pull
    sseManager.emitLog(sessionId, `[Compose] 正在执行镜像拉取: ${bin} ${argsPrefix.join(' ')} -f ${path.basename(filePath)} pull...`, 'info');
    
    try {
      const pullProcess = execa(bin, [...argsPrefix, '-f', filePath, 'pull'], {
        cwd: workingDir,
        env: { ...process.env, PATH: process.env.PATH }
      });

      pullProcess.stdout?.on('data', chunk => {
        sseManager.emitLog(sessionId, chunk.toString().trim(), 'info');
      });
      pullProcess.stderr?.on('data', chunk => {
        sseManager.emitLog(sessionId, chunk.toString().trim(), 'info');
      });

      await pullProcess;
      sseManager.emitLog(sessionId, `[Compose] 镜像拉取完成！`, 'success');
    } catch (pullErr: any) {
      sseManager.emitLog(sessionId, `[Compose] 拉取镜像出错: ${pullErr.message}`, 'error');
      throw pullErr;
    }

    // Step 2: docker compose up -d
    sseManager.emitLog(sessionId, `[Compose] 正在编排重启容器服务: ${bin} ${argsPrefix.join(' ')} -f ${path.basename(filePath)} up -d...`, 'info');

    try {
      const upProcess = execa(bin, [...argsPrefix, '-f', filePath, 'up', '-d', '--remove-orphans'], {
        cwd: workingDir,
        env: { ...process.env, PATH: process.env.PATH }
      });

      upProcess.stdout?.on('data', chunk => {
        sseManager.emitLog(sessionId, chunk.toString().trim(), 'info');
      });
      upProcess.stderr?.on('data', chunk => {
        sseManager.emitLog(sessionId, chunk.toString().trim(), 'info');
      });

      await upProcess;
      sseManager.emitLog(sessionId, `[成功] Compose 项目 ${projectName} 已成功完成升级与编排重启！`, 'success');

      // Update sqlite record
      db.prepare(`
        INSERT INTO compose_projects (name, path, last_checked_at, update_available)
        VALUES (?, ?, CURRENT_TIMESTAMP, 0)
        ON CONFLICT(name) DO UPDATE SET update_available = 0, last_checked_at = CURRENT_TIMESTAMP
      `).run(projectName, filePath);

      // Reset update_available in containers_meta for all containers in this compose project
      if (docker) {
        try {
          // Brief pause to ensure Docker daemon has registered updated containers
          await new Promise(r => setTimeout(r, 600));
          const containers = await docker.listContainers({ all: true });
          for (const c of containers) {
            if (c.Labels && c.Labels['com.docker.compose.project'] === projectName) {
              const rawName = (c.Names && c.Names[0]) || '';
              const cleanName = rawName.replace(/^\//, '');
              // Reset by container ID
              db.prepare('UPDATE containers_meta SET update_available = 0, last_checked_at = CURRENT_TIMESTAMP WHERE id = ?').run(c.Id);
              // Reset by container Name to wipe out any stale legacy IDs
              if (cleanName) {
                db.prepare('UPDATE containers_meta SET update_available = 0, last_checked_at = CURRENT_TIMESTAMP WHERE name = ?').run(cleanName);
              }
              // Ensure entry exists for current container ID with update_available = 0
              db.prepare(`
                INSERT INTO containers_meta (id, name, last_checked_at, update_available)
                VALUES (?, ?, CURRENT_TIMESTAMP, 0)
                ON CONFLICT(id) DO UPDATE SET update_available = 0, last_checked_at = CURRENT_TIMESTAMP
              `).run(c.Id, cleanName);
            }
          }
        } catch (e) {
          console.warn('[Compose] 清理更新状态失败:', e);
        }
      }

      db.prepare(`
        INSERT INTO update_history (target_type, target_name, status, log_text)
        VALUES ('compose', ?, 'success', 'Compose 项目更新成功')
      `).run(projectName);

    } catch (upErr: any) {
      sseManager.emitLog(sessionId, `[Compose] 编排重启出错: ${upErr.message}`, 'error');
      db.prepare(`
        INSERT INTO update_history (target_type, target_name, status, log_text)
        VALUES ('compose', ?, 'failed', ?)
      `).run(projectName, upErr.message);
      throw upErr;
    }
  }

  /**
   * Check update for a single compose project by checking its underlying containers
   */
  public static async checkProjectUpdate(projectName: string): Promise<{
    updateAvailable: boolean;
    updatedServices: string[];
    updateCount: number;
  }> {
    const updatedServices: string[] = [];

    // Demo mode support
    if (!docker && getSetting('demoMode', false)) {
      if (projectName === 'downloader') {
        updatedServices.push('qbittorrent');
        return { updateAvailable: true, updatedServices, updateCount: 1 };
      }
      return { updateAvailable: false, updatedServices: [], updateCount: 0 };
    }

    if (!docker) throw new Error('Docker daemon not connected');

    const containers = await docker.listContainers({ all: true });
    const targetContainers = containers.filter(
      c => c.Labels && c.Labels['com.docker.compose.project'] === projectName
    );

    if (targetContainers.length === 0) {
      return { updateAvailable: false, updatedServices: [], updateCount: 0 };
    }

    for (const c of targetContainers) {
      const service = c.Labels ? c.Labels['com.docker.compose.service'] : null;
      try {
        const checkRes = await DockerService.checkContainerUpdate(c.Id);
        if (checkRes.updateAvailable && service && !updatedServices.includes(service)) {
          updatedServices.push(service);
        }
      } catch (err: any) {
        console.warn(`[Compose] 检查项目 ${projectName} 容器 ${c.Id} 更新失败:`, err.message);
      }
    }

    const hasUpdate = updatedServices.length > 0;

    // Persist into compose_projects
    db.prepare(`
      INSERT INTO compose_projects (name, path, last_checked_at, update_available)
      VALUES (?, '', CURRENT_TIMESTAMP, ?)
      ON CONFLICT(name) DO UPDATE SET
        last_checked_at = CURRENT_TIMESTAMP,
        update_available = ?
    `).run(projectName, hasUpdate ? 1 : 0, hasUpdate ? 1 : 0);

    return {
      updateAvailable: hasUpdate,
      updatedServices,
      updateCount: updatedServices.length
    };
  }

  /**
   * Check updates for all discovered compose projects
   */
  public static async checkAllProjectsUpdate(): Promise<{
    total: number;
    withUpdates: string[];
    results: Record<string, any>;
  }> {
    const projects = await this.listProjects();
    const withUpdates: string[] = [];
    const results: Record<string, any> = {};

    for (const p of projects) {
      if (p.isIgnored) continue;
      try {
        const res = await this.checkProjectUpdate(p.name);
        results[p.name] = res;
        if (res.updateAvailable) {
          withUpdates.push(p.name);
        }
      } catch (err: any) {
        results[p.name] = { error: err.message };
      }
    }

    return {
      total: projects.length,
      withUpdates,
      results
    };
  }
}
