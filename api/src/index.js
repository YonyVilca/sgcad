import { neon } from '@neondatabase/serverless';

const baseHeaders = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const reply = (data, status = 200) => Response.json(data, { status, headers: baseHeaders });
const validCode = s => typeof s === 'string' && /^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(s);
const validName = s => typeof s === 'string' && s.trim().length > 0 && s.trim().length <= 160;
const safeEquals = (a,b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff=0; for(let i=0;i<a.length;i++) diff |= a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
};
const auth = (request, env) => {
  const credential = request.headers.get('X-SGCAD-Admin-Token');
  return Boolean(env.SGCAD_ADMIN_TOKEN && safeEquals(credential, env.SGCAD_ADMIN_TOKEN));
};
const parseJson = async request => {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) throw Error('Content-Type application/json requerido');
  const length=Number(request.headers.get('content-length')||0);
  if(length > 8192) throw Error('JSON demasiado grande');
  const text=await request.text(); if(text.length > 8192) throw Error('JSON demasiado grande');
  return JSON.parse(text);
};

export default {
  async fetch(request, env) {
    const u = new URL(request.url);
    const path = u.pathname;
    const method = request.method;
    if (method === 'GET' && path === '/') return reply({application:'SGCAD',version:'1.1.0',modules:['instrumentos','estaciones','tableros','conexiones','cables']});
    if (method === 'GET' && path === '/health') return reply({service:'SGCAD API',status:'online',version:'1.1.0',database:'not_checked'});
    if (method === 'GET' && path === '/db-test') {
      if (!env.DB_TEST_TOKEN) return reply({error:'Diagnostic disabled'},404);
      if (!safeEquals(request.headers.get('X-SGCAD-Diagnostic-Token'),env.DB_TEST_TOKEN)) return reply({error:'Unauthorized'},401);
      if (!env.DATABASE_URL) return reply({connected:false,error:'Database not configured'},503);
      try {
        const sql=neon(env.DATABASE_URL);
        const data=await sql`SELECT current_database() AS database_name, EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='sgcad' AND table_name='proyecto') AS schema_ready`;
        return reply({connected:true,database:data[0].database_name,schema_ready:data[0].schema_ready});
      } catch { return reply({connected:false,error:'Database unavailable'},503); }
    }
    // Operaciones administrativas de arranque: NO distribuir token a usuarios ni incluir en LISP.
    if (path === '/admin/projects' || path === '/admin/stations') {
      if (!auth(request,env)) return reply({error:'Unauthorized'},401);
      if (!env.DATABASE_URL) return reply({error:'Database not configured'},503);
      if (!['GET','POST'].includes(method)) return reply({error:'Method not allowed'},405);
      let body;
      if (method==='POST') {
        try { body=await parseJson(request); } catch {return reply({error:'JSON invalido'},400);}
      }
      try {
        const sql=neon(env.DATABASE_URL);
        if(path==='/admin/projects') {
          if(method==='GET') return reply({projects:await sql`SELECT id,codigo,nombre,norma_base FROM sgcad.proyecto ORDER BY codigo LIMIT 250`});
          const codigo=body?.codigo?.trim().toUpperCase(), nombre=body?.nombre?.trim();
          if(!validCode(codigo)||!validName(nombre)) return reply({error:'codigo o nombre invalido'},400);
          const r=await sql`INSERT INTO sgcad.proyecto(codigo,nombre,norma_base) VALUES (${codigo},${nombre},'GPDA0036') ON CONFLICT(codigo) DO UPDATE SET nombre=EXCLUDED.nombre RETURNING id,codigo,nombre`;
          return reply({project:r[0]},201);
        }
        if(method==='GET') {
          const code=u.searchParams.get('project');
          if(!validCode(code)) return reply({error:'project requerido'},400);
          return reply({stations:await sql`SELECT e.id,e.codigo,e.nombre,e.proyecto_id FROM sgcad.estacion e JOIN sgcad.proyecto p ON p.id=e.proyecto_id WHERE p.codigo=${code} ORDER BY e.codigo LIMIT 250`});
        }
        const project=body?.project?.trim().toUpperCase();
        const codigo=body?.codigo?.trim().toUpperCase();
        const nombre=body?.nombre?.trim();
        if(!validCode(project)||!validCode(codigo)||!validName(nombre)) return reply({error:'project, codigo o nombre invalido'},400);
        const projects=await sql`SELECT id FROM sgcad.proyecto WHERE codigo=${project}`;
        if(!projects.length) return reply({error:'Proyecto no encontrado'},404);
        const r=await sql`INSERT INTO sgcad.estacion(proyecto_id,codigo,nombre) VALUES (${projects[0].id},${codigo},${nombre}) ON CONFLICT(proyecto_id,codigo) DO UPDATE SET nombre=EXCLUDED.nombre RETURNING id,codigo,nombre,proyecto_id`;
        return reply({station:r[0]},201);
      } catch {return reply({error:'Database operation failed'},503);}
    }
    return reply({error:'Ruta no encontrada'},404);
  }
};
