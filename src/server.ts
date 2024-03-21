import fastify from 'fastify';
import { PostgresError } from 'postgres';
import { z } from 'zod';
import { sql } from './lib/postgres';
import { redis } from './lib/redis';

const app = fastify();

app.get('/', async (request, reply) => {
  reply.send('App is running!');
});

app.get('/:code', async (request, reply) => {
  const getLinkSchema = z.object({
    code: z.string().min(3),
  });

  const { code } = getLinkSchema.parse(request.params);

  const result = await sql`
    SELECT *
    FROM short_links
    WHERE code = ${code}
  `;

  if (result.length === 0) {
    return reply.status(404).send({ error: 'Link not found' });
  }

  const { url, id } = result[0];

  await redis.zIncrBy('ranking', 1, String(id));

  reply.redirect(301, url);
});

app.post('/api/links', async (request, reply) => {
  const createLinkSchema = z.object({
    code: z.string().min(3),
    url: z.string().url(),
  });

  const { code, url } = createLinkSchema.parse(request.body);

  try {
    const result = await sql`
      INSERT INTO short_links (code, url)
      VALUES (${code}, ${url})
      RETURNING id
    `;

    reply.status(201).send({ shortLinkId: result[0].id });
  } catch (error) {
    if (error instanceof PostgresError) {
      if (error.code === '23505') {
        return reply.status(409).send({ error: 'Duplicated code' });
      }
    }

    console.error(error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
});

app.get('/api/links', async (request, reply) => {
  const result = await sql`
    SELECT *
    FROM short_links
  `;

  reply.send(result);
});

app.get('/api/ranking', async (request, reply) => {
  const result = await redis.zRangeByScoreWithScores('ranking', 0, 50);

  const ranking = result.sort((a, b) => b.score - a.score).map((item) => ({
    shortLinkId: Number(item.value),
    clicks: item.score,
  }));

  reply.send(ranking);
});

app.listen({ port: 3000 }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});
