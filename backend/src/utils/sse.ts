import { FastifyReply } from 'fastify';

interface SSEClient {
  id: string;
  sessionId?: string;
  reply: FastifyReply;
}

class SSEManager {
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatTimer?: NodeJS.Timeout;

  constructor() {
    // Send keepalive comment every 15s to keep connections alive through proxies
    this.heartbeatTimer = setInterval(() => {
      this.clients.forEach(client => {
        try {
          client.reply.raw.write(': keepalive\n\n');
        } catch (e) {
          // ignore closed socket
        }
      });
    }, 15000);
  }

  public addClient(id: string, reply: FastifyReply, sessionId?: string) {
    this.clients.set(id, { id, sessionId, reply });

    reply.raw.on('close', () => {
      this.clients.delete(id);
    });
  }

  public broadcast(event: string, data: any) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    this.clients.forEach(client => {
      try {
        client.reply.raw.write(payload);
      } catch (err) {
        this.clients.delete(client.id);
      }
    });
  }

  public emitLog(sessionId: string, text: string, level: 'info' | 'warn' | 'error' | 'success' = 'info') {
    const payload = `event: log\ndata: ${JSON.stringify({ sessionId, text, level, timestamp: new Date().toISOString() })}\n\n`;
    this.clients.forEach(client => {
      if (!client.sessionId || client.sessionId === sessionId) {
        try {
          client.reply.raw.write(payload);
        } catch (err) {
          this.clients.delete(client.id);
        }
      }
    });
  }

  public emitStatus(sessionId: string, status: string, progress?: number) {
    const payload = `event: status\ndata: ${JSON.stringify({ sessionId, status, progress, timestamp: new Date().toISOString() })}\n\n`;
    this.clients.forEach(client => {
      if (!client.sessionId || client.sessionId === sessionId) {
        try {
          client.reply.raw.write(payload);
        } catch (err) {
          this.clients.delete(client.id);
        }
      }
    });
  }
}

export const sseManager = new SSEManager();
