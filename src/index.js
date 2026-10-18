import { neon } from '@neondatabase/serverless';

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const respond = (data, status = 200) => Response.json(data, { status, headers });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'GET') return respond({ error: 'Method not allowed' }, 405);

    if (url.pathname === '/') {
      return respond({ application: 'SGCAD', message: 'API de ingenieria CAD', version: '1.1.0', modules: ['instrumentos', 'estaciones', 'tableros', 'conexiones', 'cables'] });
    }
    if (url.pathname === '/health') {
      return respond({ service: 'SGCAD API', status: 'online', version: '1.1.0', database: 'not_checked' });
    }
    if (url.pathname === '/db-test') {
      // Diagnostic endpoint. Require a separate secret; never publish connection details.
      // Set DB_TEST_TOKEN in Cloudflare Secrets before enabling this test.
      if (!env.DB_TEST_TOKEN) return respond({ error: 'Diagnostic disabled' }, 404);
      const token = request.headers.get('X-SGCAD-Diagnostic-Token');
      if (!token || token !== env.DB_TEST_TOKEN) return respond({ error: 'Unauthorized' }, 401);
      if (!env.DATABASE_URL) return respond({ connected: false, error: 'Database not configured' }, 503);
      try {
        const sql = neon(env.DATABASE_URL);
        const rows = await sql`SELECT current_database() AS database_name, EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'sgcad' AND table_name = 'proyecto'
        ) AS schema_ready`;
        return respond({ connected: true, database: rows[0].database_name, schema_ready: rows[0].schema_ready });
      } catch (_) {
        return respond({ connected: false, error: 'Database unavailable' }, 503);
      }
    }
    return respond({ error: 'Ruta no encontrada' }, 404);
  }
};
