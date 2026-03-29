import { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { schema } from '../../db/index.js';
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

export async function renderRoutes(app: FastifyInstance) {
  const db = (app as any).db as BetterSQLite3Database<typeof schema>;

  app.post('/edit/v1/render', async (req, reply) => {
    const body = req.body as any;
    const id = nanoid(21);

    await db.insert(schema.renders).values({
      id,
      status: 'queued',
      timeline: JSON.stringify(body.timeline),
      output: JSON.stringify(body.output),
      callback: body.callback ?? null,
    });

    reply.status(201).send({
      success: true,
      message: 'Created',
      response: {
        id,
        owner: 'renderforge',
        status: 'queued',
        url: null,
        data: null,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      },
    });
  });

  app.get('/edit/v1/render/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const [render] = await db.select().from(schema.renders).where(eq(schema.renders.id, id));

    if (!render) {
      return reply.status(404).send({ success: false, message: 'Render not found' });
    }

    reply.send({
      success: true,
      message: 'OK',
      response: {
        id: render.id,
        owner: 'renderforge',
        status: render.status,
        url: render.url,
        poster: render.poster,
        thumbnail: render.thumbnail,
        error: render.error,
        data: {
          output: JSON.parse(render.output ?? '{}'),
        },
        created: render.createdAt,
        updated: render.updatedAt,
      },
    });
  });
}
