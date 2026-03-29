import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config/index.js';

export async function authMiddleware(req: FastifyRequest, reply: FastifyReply) {
  if (!config.auth.enabled) return;

  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (!apiKey || !config.auth.apiKeys.includes(apiKey)) {
    reply.status(401).send({ success: false, message: 'Unauthorized: invalid API key' });
  }
}
