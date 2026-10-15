import axios from 'axios';
import { db, getSetting } from '../db/database';
import { NotificationChannel } from '../types';

export class NotificationService {
  public static getChannels(): NotificationChannel[] {
    const rows = db.prepare('SELECT * FROM notifications').all() as any[];
    return rows.map(r => ({
      id: r.id,
      type: r.type,
      name: r.name,
      enabled: !!r.enabled,
      config: JSON.parse(r.config_json || '{}')
    }));
  }

  public static saveChannel(channel: NotificationChannel): void {
    db.prepare(`
      INSERT INTO notifications (id, type, name, enabled, config_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = ?,
        name = ?,
        enabled = ?,
        config_json = ?
    `).run(
      channel.id,
      channel.type,
      channel.name,
      channel.enabled ? 1 : 0,
      JSON.stringify(channel.config),
      channel.type,
      channel.name,
      channel.enabled ? 1 : 0,
      JSON.stringify(channel.config)
    );
  }

  public static deleteChannel(id: string): void {
    db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
  }

  /**
   * Broadcast message to all enabled notification channels
   */
  public static async notifyAll(title: string, content: string): Promise<void> {
    const channels = this.getChannels().filter(c => c.enabled);
    for (const ch of channels) {
      try {
        await this.sendToChannel(ch, title, content);
      } catch (err: any) {
        console.error(`[Notification] Failed to send to ${ch.name} (${ch.type}):`, err.message);
      }
    }
  }

  public static async sendToChannel(ch: NotificationChannel, title: string, content: string): Promise<void> {
    const proxyUrl = getSetting<string>('httpProxy', '');
    const axiosConfig: any = { timeout: 10000 };
    if (proxyUrl) {
      try {
        const u = new URL(proxyUrl);
        axiosConfig.proxy = {
          protocol: u.protocol.replace(':', ''),
          host: u.hostname,
          port: parseInt(u.port || '80', 10)
        };
      } catch {}
    }

    const { type, config } = ch;

    switch (type) {
      case 'wecom': {
        if (!config.webhookUrl) throw new Error('企业微信 Webhook URL 未配置');
        await axios.post(
          config.webhookUrl,
          {
            msgtype: 'markdown',
            markdown: {
              content: `### ${title}\n${content}\n> 来自 fnOS Docker 更新面板`
            }
          },
          axiosConfig
        );
        break;
      }

      case 'dingtalk': {
        if (!config.webhookUrl) throw new Error('钉钉 Webhook URL 未配置');
        await axios.post(
          config.webhookUrl,
          {
            msgtype: 'markdown',
            markdown: {
              title: title,
              text: `### ${title}\n\n${content}\n\n> fnOS Docker Updater`
            }
          },
          axiosConfig
        );
        break;
      }

      case 'feishu': {
        if (!config.webhookUrl) throw new Error('飞书 Webhook URL 未配置');
        await axios.post(
          config.webhookUrl,
          {
            msg_type: 'post',
            content: {
              post: {
                zh_cn: {
                  title: title,
                  content: [
                    [{ tag: 'text', text: content }],
                    [{ tag: 'text', text: '\n来自 fnOS Docker 更新面板' }]
                  ]
                }
              }
            }
          },
          axiosConfig
        );
        break;
      }

      case 'bark': {
        const server = (config.serverUrl || 'https://api.day.app').replace(/\/+$/, '');
        const deviceKey = config.deviceKey;
        if (!deviceKey) throw new Error('Bark Device Key 未配置');
        await axios.post(
          `${server}/${deviceKey}`,
          {
            title: title,
            body: content,
            group: 'fnOS Docker Updater'
          },
          axiosConfig
        );
        break;
      }

      case 'telegram': {
        const botToken = config.botToken;
        const chatId = config.chatId;
        if (!botToken || !chatId) throw new Error('Telegram Bot Token 或 Chat ID 未配置');
        await axios.post(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            chat_id: chatId,
            text: `*${title}*\n\n${content}`,
            parse_mode: 'Markdown'
          },
          axiosConfig
        );
        break;
      }

      case 'webhook': {
        if (!config.url) throw new Error('自定义 Webhook URL 未配置');
        let body = config.payload || '{"title":"{{title}}","content":"{{content}}"}';
        body = body.replace(/\{\{title\}\}/g, title).replace(/\{\{content\}\}/g, content);
        let parsedBody;
        try {
          parsedBody = JSON.parse(body);
        } catch {
          parsedBody = { title, content };
        }
        await axios.post(config.url, parsedBody, {
          ...axiosConfig,
          headers: config.headers ? JSON.parse(config.headers) : undefined
        });
        break;
      }

      default:
        throw new Error(`不支持的通知渠道类型: ${type}`);
    }
  }
}
