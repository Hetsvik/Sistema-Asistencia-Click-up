#!/usr/bin/env node
// Prueba rápida de un despliegue (local o en Cloudflare):
//   node scripts/smoke.mjs https://erp-construcciones-sac.<tu-subdominio>.workers.dev
// Opcional (para probar el login real):  SMOKE_CODE=AD001 SMOKE_PIN=xxxx SMOKE_ADMIN=1 node scripts/smoke.mjs <url>

const base = (process.argv[2] ?? 'http://localhost:8787').replace(/\/$/, '');
let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? '✔' : '✘'} ${name}${extra ? ` — ${extra}` : ''}`); if (!ok) failed++; };

async function get(path, init) { return fetch(base + path, { redirect: 'manual', ...init }); }

for (const page of ['/', '/admin/inicio', '/admin/asistencia', '/admin/tareas', '/admin/reportes', '/usuarios/inicio', '/usuarios/asistencia', '/usuarios/tareas', '/usuarios/reportes', '/css/styles.css', '/js/config.js']) {
  const r = await get(page);
  check(`GET ${page}`, r.status === 200, String(r.status));
}
let r = await get('/api/auth/me');
check('GET /api/auth/me sin sesión → 401', r.status === 401, String(r.status));
r = await get('/api/tasks');
check('GET /api/tasks sin sesión → 401', r.status === 401, String(r.status));
r = await get('/api/nope');
check('GET /api/nope → 404', r.status === 404, String(r.status));
r = await get('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo: 'NOEXISTE', pin: 'x', es_admin: false }) });
check('login con datos falsos → 401 (si da 500, falta SESSION_SECRET o migrar la BD)', r.status === 401, String(r.status));

if (process.env.SMOKE_CODE && process.env.SMOKE_PIN) {
  r = await get('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo: process.env.SMOKE_CODE, pin: process.env.SMOKE_PIN, es_admin: !!process.env.SMOKE_ADMIN }) });
  const cookie = r.headers.get('set-cookie') ?? '';
  check('login real → 200', r.status === 200, String(r.status));
  check('cookie HttpOnly + SameSite', /HttpOnly/i.test(cookie) && /SameSite=Lax/i.test(cookie));
  if (base.startsWith('https')) check('cookie Secure (HTTPS)', /Secure/i.test(cookie));
  const session = cookie.split(';')[0];
  for (const path of ['/api/auth/me', '/api/tasks', '/api/reports/summary?periodo=todo', '/api/attendance']) {
    const x = await get(path, { headers: { Cookie: session } });
    check(`GET ${path} con sesión → 200`, x.status === 200, String(x.status));
  }
}
console.log(failed ? `\n${failed} prueba(s) fallaron.` : '\nTodo en orden.');
process.exit(failed ? 1 : 0);
