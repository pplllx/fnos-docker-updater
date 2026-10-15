export interface ContainerItem {
  id: string;
  name: string;
  image: string;
  imageId: string;
  tag: string;
  status: string;
  state: 'running' | 'exited' | 'paused' | 'restarting' | string;
  created: number;
  isCompose: boolean;
  composeProject?: string;
  composeFile?: string;
  ports: string[];
  currentDigest?: string;
  remoteDigest?: string;
  updateAvailable: boolean;
  isIgnored: boolean;
  isPinned: boolean;
  lastCheckedAt?: string;
}

export interface ComposeProjectItem {
  name: string;
  path: string;
  services: string[];
  status: 'running' | 'partially_running' | 'stopped';
  containers: string[];
  updateAvailable: boolean;
  updatedServices?: string[];
  updateCount?: number;
  isIgnored: boolean;
  lastCheckedAt?: string;
}

export interface SystemSettings {
  registryMirrors: string[];
  httpProxy: string;
  cronSchedule: string; // e.g. "0 3 * * *"
  cronEnabled: boolean;
  autoUpdateEnabled: boolean;
  autoPruneImages: boolean;
  composeScanPaths: string[];
  passwordless: boolean;
  initialized: boolean;
}

export type NotificationType = 'wecom' | 'dingtalk' | 'feishu' | 'bark' | 'telegram' | 'webhook';

export interface NotificationChannel {
  id: string;
  type: NotificationType;
  name: string;
  enabled: boolean;
  config: Record<string, any>;
}

export interface UpdateRecord {
  id: number;
  targetType: 'container' | 'compose';
  targetName: string;
  fromDigest: string;
  toDigest: string;
  status: 'success' | 'failed' | 'rolled_back';
  logText: string;
  createdAt: string;
}
