import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../connection.js';
import { executePipeline } from '../../render/pipeline.js';
import { getDb, schema } from '../../db/index.js';
import { eq } from 'drizzle-orm';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { config } from '../../config/index.js';

export function createRenderWorker(db?: ReturnType<typeof getDb>) {
  const database = db ?? getDb();

  const worker = new Worker('render', async (job: Job) => {
    const { renderId, timeline, output, merge, callback } = job.data;
    const workDir = join(config.storage.path, 'renders', renderId);
    mkdirSync(workDir, { recursive: true });

    const updateStatus = async (status: string) => {
      await database.update(schema.renders)
        .set({ status: status as any, updatedAt: new Date() })
        .where(eq(schema.renders.id, renderId));
    };

    try {
      const result = await executePipeline(
        { timeline: JSON.parse(timeline), output: JSON.parse(output), merge },
        workDir,
        updateStatus,
      );

      // Update render record with result URL
      const assetUrl = `/serve/v1/assets/${renderId}/output.${result.format}`;
      await database.update(schema.renders)
        .set({ status: 'done', url: assetUrl, updatedAt: new Date() })
        .where(eq(schema.renders.id, renderId));

      // Fire callback webhook if configured
      if (callback) {
        try {
          await fetch(callback, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'render',
              action: 'done',
              id: renderId,
              url: assetUrl,
            }),
          });
        } catch {
          // Callback failure is non-fatal
        }
      }

      return result;
    } catch (error: any) {
      await database.update(schema.renders)
        .set({ status: 'failed', error: error.message, updatedAt: new Date() })
        .where(eq(schema.renders.id, renderId));
      throw error;
    }
  }, {
    connection: getRedisConnection(),
    concurrency: 2,
  });

  return worker;
}
