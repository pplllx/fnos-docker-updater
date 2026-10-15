import fs from 'fs';
import path from 'path';
import { execa } from 'execa';
import { db, getSetting } from '../db/database';
import { ComposeProjectItem } from '../types';
import { sseManager } from '../utils/sse';
import { docker } from './docker.service';

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
                isIgnored: false
              };
              projectsMap.set(project, item);
            }

            if (service && !item.services.includes(service)) {
              item.services.push(service);
            }
            const rawName = (c.Names && c.Names[0]) || c.Id;
            item.containers.push(rawName.replace(/^\//, ''));

            if (c.State === 'running') {
              item.status = item.status === 'stopped' ? 'partially_running' : 'running';
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

    // 3. Merge database metadata
    const metaRows = db.prepare('SELECT * FROM compose_projects').all() as any[];
    const metaMap = new Map<string, any>();
    metaRows.forEach(r => metaMap.set(r.name, r));

    const result: ComposeProjectItem[] = [];
    for (const [name, item] of projectsMap.entries()) {
      const meta = metaMap.get(name);
      if (meta) {
        item.isIgnored = !!meta.is_ignored;
        item.updateAvailable = !!meta.update_available;
        item.lastCheckedAt = meta.last_checked_at;
      }
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
}
