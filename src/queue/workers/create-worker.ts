import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../connection.js';
import { generateAIAsset } from '../../render/assets/ai.js';
import { generations } from '../../api/create/generate.js';
import type { AIGenerateRequest, ProviderConfig } from '../../render/assets/ai.js';

export function createCreateWorker() {
  const worker = new Worker('create', async (job: Job) => {
    const { generationId, request, providerConfig } = job.data as {
      generationId: string;
      request: AIGenerateRequest;
      providerConfig: ProviderConfig;
    };

    const record = generations.get(generationId);
    if (record) {
      record.status = 'processing';
      record.updatedAt = new Date().toISOString();
    }

    try {
      const result = await generateAIAsset(request, providerConfig);

      if (record) {
        record.status = 'done';
        record.resultUrl = result.url;
        record.resultType = result.type;
        record.updatedAt = new Date().toISOString();
      }

      return result;
    } catch (error: any) {
      if (record) {
        record.status = 'failed';
        record.error = error.message;
        record.updatedAt = new Date().toISOString();
      }
      throw error;
    }
  }, {
    connection: getRedisConnection(),
    concurrency: 2,
  });

  return worker;
}
