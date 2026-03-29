import Fastify from 'fastify';
import cors from '@fastify/cors';
import { getDb } from './db/index.js';
import { renderRoutes } from './api/edit/render.js';

export async function createServer(opts?: { testing?: boolean }) {
  const app = Fastify({
    logger: opts?.testing ? false : {
      transport: { target: 'pino-pretty' },
    },
  });

  await app.register(cors);

  // Initialize DB (in-memory for tests, file-based otherwise)
  const dbPath = opts?.testing ? ':memory:' : undefined;
  const db = getDb(dbPath, { migrate: true });

  // Attach db to app for routes to use
  (app as any).db = db;

  app.get('/', async () => ({
    name: 'renderforge',
    version: '0.1.0',
    status: 'ok',
  }));

  // Register API routes
  await app.register(renderRoutes);

  if (!opts?.testing) {
    await app.ready();
  }

  return app;
}
