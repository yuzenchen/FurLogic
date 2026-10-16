export default async function healthRoutes(app) {
  app.get('/health', { schema: {} }, async (request, reply) => {
    try {
      app.db.prepare('SELECT 1').get();
      return { ok: true, db: 'ok' };
    } catch (err) {
      request.log.error(err, 'health check: db error');
      return reply.code(503).send({ ok: false, db: 'error' });
    }
  });
}
