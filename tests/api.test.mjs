import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApi } from '../src/index.js';
import { createTestDb } from './d1-shim.mjs';
import { nowLocal } from '../src/lib/dates.js';

const env = { DB: createTestDb(), SESSION_SECRET: 'secreto-de-pruebas-1234567890', TIMEZONE: 'America/Lima' };
const ORIGIN = 'http://localhost';

async function call(method, path, { body, cookie } = {}) {
  const res = await handleApi(new Request(ORIGIN + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), 'CF-Connecting-IP': '1.1.1.1' },
    body: body ? JSON.stringify(body) : undefined,
  }), env);
  const set = res.headers.get('Set-Cookie');
  return { status: res.status, data: await res.json(), cookie: set ? set.split(';')[0] : null, raw: set };
}
const login = async (codigo, pin, es_admin = false) => (await call('POST', '/api/auth/login', { body: { codigo, pin, es_admin } }));

test('rutas protegidas exigen sesión', async () => {
  assert.equal((await call('GET', '/api/tasks')).status, 401);
  assert.equal((await call('GET', '/api/nope')).status, 404);
  assert.equal((await call('DELETE', '/api/tasks')).status, 405);
});

test('login: credenciales incorrectas, cookie HttpOnly y migración de PIN a hash', async () => {
  assert.equal((await login('TEST001', 'mal')).status, 401);
  const ok = await login('TEST001', '1234');
  assert.equal(ok.status, 200);
  assert.match(ok.raw, /HttpOnly/);
  assert.equal(ok.data.user.rol, 'trabajador');
  const stored = env.DB.raw.prepare("SELECT PIN_Acceso p FROM Trabajadores WHERE Codigo_Trabajador='TEST001'").get().p;
  assert.match(stored, /^pbkdf2\$/);
  assert.equal((await login('TEST001', '1234')).status, 200, 'sigue funcionando con el hash');
  assert.equal((await login('TESTADM', 'admin1234', false)).status, 401, 'un admin no entra como trabajador');
});

test('login: bloqueo tras 5 intentos fallidos', async () => {
  for (let i = 0; i < 5; i++) await login('TEST003', 'x');
  const r = await login('TEST003', '1234');
  assert.equal(r.status, 429);
});

test('asistencia: entrada, duplicado, salida', async () => {
  const { cookie } = await login('TEST002', '1234');
  const t = await call('GET', '/api/attendance/today', { cookie });
  assert.equal(t.data.registro, null);
  assert.equal(t.data.tz, "America/Lima");
  assert.equal((await call('PUT', '/api/attendance/check-out', { cookie })).status, 409);
  const a = await call('POST', '/api/attendance/check-in', { cookie });
  assert.equal(a.status, 201);
  assert.equal(a.data.registro.fecha, nowLocal('America/Lima').fecha);
  assert.equal((await call('POST', '/api/attendance/check-in', { cookie })).status, 409);
  const b = await call('PUT', '/api/attendance/check-out', { cookie });
  assert.equal(b.status, 200);
  assert.ok(b.data.registro.salida);
  assert.equal((await call('PUT', '/api/attendance/check-out', { cookie })).status, 409);
});

test('asistencia: trabajador ve lo suyo, admin filtra por nombre', async () => {
  const w = await login('TEST001', '1234');
  const mine = await call('GET', '/api/attendance', { cookie: w.cookie });
  assert.ok(mine.data.records.every((r) => r.nombre === 'Ana Torres'));
  const adm = await login('TESTADM', 'admin1234', true);
  const all = await call('GET', '/api/attendance?q=Luis', { cookie: adm.cookie });
  assert.ok(all.data.records.length >= 1 && all.data.records.every((r) => r.nombre.includes('Luis')));
  assert.equal((await call('PUT', '/api/attendance/check-out', { cookie: adm.cookie })).status, 403);
  assert.equal((await call('GET', '/api/attendance?desde=ayer', { cookie: adm.cookie })).status, 400);
});

test('tareas: aislamiento entre trabajadores y flujo de estados', async () => {
  const ana = (await login('TEST001', '1234')).cookie;
  const luis = (await login('TEST002', '1234')).cookie;
  const list = await call('GET', '/api/tasks', { cookie: ana });
  assert.deepEqual([...new Set(list.data.tasks.map((t) => t.trabajador))], ['Ana Torres']);
  assert.equal(list.data.tasks[0].prioridad, 'Alta');
  assert.equal((await call('GET', '/api/tasks/1', { cookie: luis })).status, 404, 'no ve tareas ajenas');
  assert.equal((await call('PUT', '/api/tasks/1/status', { cookie: luis, body: { estado: 'Completada' } })).status, 404);
  assert.equal((await call('PUT', '/api/tasks/1/status', { cookie: ana, body: { estado: 'Pendiente' } })).status, 400);
  assert.equal((await call('PUT', '/api/tasks/1/status', { cookie: ana, body: { estado: 'En Progreso' } })).status, 200);
  assert.equal((await call('PUT', '/api/tasks/1/status', { cookie: ana, body: { estado: 'Asignada' } })).status, 409, 'no retrocede');
  assert.equal((await call('POST', '/api/tasks/1/comments', { cookie: ana, body: { mensaje: 'Hola', autor: 'Falso' } })).status, 201);
  const c = await call('GET', '/api/tasks/1/comments', { cookie: ana });
  assert.equal(c.data.comments.at(-1).autor, 'Ana Torres', 'el autor sale de la sesión');
  assert.equal(c.data.comments.at(-1).rol, 'Empleado');
});

test('tareas: solo el admin crea; valida datos; marca entrega fuera de plazo', async () => {
  const ana = (await login('TEST001', '1234')).cookie;
  const adm = (await login('TESTADM', 'admin1234', true)).cookie;
  const base = { trabajador_id: 2, proyecto_id: 1, descripcion: 'Nueva tarea', fecha_entrega: '2999-01-01T10:00' };
  assert.equal((await call('POST', '/api/tasks', { cookie: ana, body: base })).status, 403);
  assert.equal((await call('POST', '/api/tasks', { cookie: adm, body: { ...base, fecha_entrega: 'x' } })).status, 400);
  assert.equal((await call('POST', '/api/tasks', { cookie: adm, body: { ...base, trabajador_id: 99 } })).status, 400);
  const ok = await call('POST', '/api/tasks', { cookie: adm, body: base });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.task.prioridad, 'Baja');
  const nuevo = await call('POST', '/api/tasks', { cookie: adm, body: { ...base, proyecto_id: undefined, proyecto_nuevo: { nombre: 'Obra Z', area: 'Obras' }, fecha_entrega: '2000-01-01T10:00', fecha_inicio: '1999-12-31T10:00' } });
  assert.equal(nuevo.status, 201);
  assert.equal(nuevo.data.task.proyecto, 'Obra Z');
  const done = await call('PUT', `/api/tasks/${nuevo.data.task.id}/status`, { cookie: adm, body: { estado: 'Completada' } });
  assert.match(done.data.task.observaciones, /FUERA DE PLAZO/);
});

test('reportes: trabajador solo ve lo suyo; admin ve total o un trabajador', async () => {
  const ana = (await login('TEST001', '1234')).cookie;
  const adm = (await login('TESTADM', 'admin1234', true)).cookie;
  const mine = await call('GET', '/api/reports/summary?periodo=todo&trabajador=2', { cookie: ana });
  assert.equal(mine.data.trabajador.nombre, 'Ana Torres');
  const total = await call('GET', '/api/reports/summary?periodo=todo', { cookie: adm });
  assert.equal(total.data.trabajador, null);
  assert.ok(total.data.tareas.total >= 4);
  const one = await call('GET', '/api/reports/summary?periodo=mes&trabajador=3', { cookie: adm });
  assert.equal(one.data.trabajador.nombre, 'Carla Mendoza');
  assert.equal((await call('GET', '/api/reports/summary?periodo=siglo', { cookie: adm })).status, 400);
  assert.equal((await call('GET', '/api/users', { cookie: ana })).status, 403);
  assert.equal((await call('GET', '/api/users?q=lui', { cookie: adm })).data.users.length, 1);
});

test('CSRF: mutaciones desde otro origen se rechazan; logout limpia cookie', async () => {
  const res = await handleApi(new Request(ORIGIN + '/api/auth/login', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}' }), env);
  assert.equal(res.status, 403);
  const out = await call('POST', '/api/auth/logout');
  assert.match(out.raw, /Max-Age=0/);
});

test('cookie manipulada es rechazada', async () => {
  const { cookie } = await login('TEST001', '1234');
  const forged = cookie.replace(/\.[^.]+$/, '.AAAA');
  assert.equal((await call('GET', '/api/auth/me', { cookie: forged })).status, 401);
});
