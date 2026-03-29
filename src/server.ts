import Fastify from 'fastify';
import cors from '@fastify/cors';
import { getDb } from './db/index.js';
import { renderRoutes } from './api/edit/render.js';
import { sourcesRoutes } from './api/ingest/sources.js';
import { uploadRoutes } from './api/ingest/upload.js';
import { createRenderWorker } from './queue/workers/render-worker.js';
import { createIngestWorker } from './queue/workers/ingest-worker.js';
import { createQueues } from './queue/queues.js';
import type { Worker } from 'bullmq';

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
  await app.register(sourcesRoutes);
  await app.register(uploadRoutes);

  // Start render worker and queues (skip in test mode)
  if (!opts?.testing) {
    const queues = createQueues();
    (app as any).queues = queues;

    const renderWorker = createRenderWorker(db);
    (app as any).renderWorker = renderWorker;

    const ingestWorker = createIngestWorker(db);
    (app as any).ingestWorker = ingestWorker;

    app.addHook('onClose', async () => {
      await renderWorker.close();
      await ingestWorker.close();
      await Promise.all(Object.values(queues).map((q: any) => q.close()));
    });

    await app.ready();
  }

  return app;
}
