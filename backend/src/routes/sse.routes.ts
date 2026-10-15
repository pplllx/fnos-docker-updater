import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sseManager } from '../utils/sse';

export async function sseRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (req: FastifyRequest<{
    Querystring: { sessionId?: string };
  }>, reply: FastifyReply) => {
    const { sessionId } = req.query;
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');

    // Register client in SSE manager
    sseManager.addClient(clientId, reply, sessionId);

    // Initial greeting event
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ clientId, sessionId, message: 'SSE stream connected' })}\n\n`);
  });
}
