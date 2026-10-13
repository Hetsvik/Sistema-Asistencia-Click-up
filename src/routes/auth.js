import { HttpError, json, readJson } from '../lib/http.js';
import { hashPin, needsRehash, verifyPin } from '../lib/security.js';
import { clearCookie, sessionCookie, signSession } from '../lib/session.js';

const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

const QUERIES = {
  admin: {
    select: `SELECT A.ID_Administrador AS id, A.Codigo_Administrador AS codigo, A.PIN_Acceso AS pin,
                    E.Nombre_Completo AS nombre, E.Estado AS estado, NULL AS cargo
             FROM Administrador A JOIN Empleados E ON E.ID_Empleado = A.ID_Empleado
             WHERE A.Codigo_Administrador = ? COLLATE NOCASE`,
    update: 'UPDATE Administrador SET PIN_Acceso = ? WHERE ID_Administrador = ?',
  },
  trabajador: {
    select: `SELECT T.ID_Trabajador AS id, T.Codigo_Trabajador AS codigo, T.PIN_Acceso AS pin,
                    E.Nombre_Completo AS nombre, E.Estado AS estado, T.Rol_Cargo AS cargo
             FROM Trabajadores T JOIN Empleados E ON E.ID_Empleado = T.ID_Empleado
             WHERE T.Codigo_Trabajador = ? COLLATE NOCASE`,
    update: 'UPDATE Trabajadores SET PIN_Acceso = ? WHERE ID_Trabajador = ?',
  },
};

async function assertNotLocked(db, key) {
  const row = await db.prepare('SELECT Bloqueado_Hasta AS hasta FROM Intentos_Login WHERE Clave = ?').bind(key).first();
  if (!row || !row.hasta) return;
  if (row.hasta > Date.now()) {
    const retry = Math.ceil((row.hasta - Date.now()) / 1000);
    throw new HttpError(429, 'Demasiados intentos fallidos. Inténtalo de nuevo en unos minutos.', { 'Retry-After': String(retry) });
  }
  await db.prepare('DELETE FROM Intentos_Login WHERE Clave = ?').bind(key).run();
}

const registerFailure = (db, key) =>
  db.prepare(`INSERT INTO Intentos_Login (Clave, Intentos, Bloqueado_Hasta, Actualizado) VALUES (?1, 1, 0, ?2)
              ON CONFLICT(Clave) DO UPDATE SET Intentos = Intentos + 1, Actualizado = ?2,
                Bloqueado_Hasta = CASE WHEN Intentos + 1 >= ?3 THEN ?4 ELSE 0 END`)
    .bind(key, Date.now(), MAX_ATTEMPTS, Date.now() + LOCK_MS).run();

export async function login({ request, env, url }) {
  const body = await readJson(request);
  const codigo = typeof body.codigo === 'string' ? body.codigo.trim().slice(0, 40) : '';
  const pin = typeof body.pin === 'string' ? body.pin.slice(0, 128) : '';
  if (!codigo || !pin) throw new HttpError(400, 'Ingresa tu código y tu PIN.');

  const rol = body.es_admin ? 'admin' : 'trabajador';
  const key = `${rol}:${codigo.toLowerCase()}|${request.headers.get('CF-Connecting-IP') ?? 'local'}`;
  await assertNotLocked(env.DB, key);

  const q = QUERIES[rol];
  const row = await env.DB.prepare(q.select).bind(codigo).first();
  // Se hace el hash aunque el usuario no exista, para no revelar su existencia por tiempo de respuesta.
  const valid = row ? await verifyPin(pin, row.pin) : (await hashPin(pin), false);

  if (!row || !valid || row.estado !== 'Activo') {
    await registerFailure(env.DB, key);
    throw new HttpError(401, 'Código o PIN incorrecto.');
  }

  await env.DB.prepare('DELETE FROM Intentos_Login WHERE Clave = ?').bind(key).run();
  if (needsRehash(row.pin)) await env.DB.prepare(q.update).bind(await hashPin(pin), row.id).run();

  const user = { id: row.id, codigo: row.codigo, nombre: row.nombre, cargo: row.cargo, rol };
  const token = await signSession(env, user);
  return json({ user }, 200, { 'Set-Cookie': sessionCookie(token, url) });
}

export async function logout({ url }) {
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie(url) });
}

export async function me({ user }) {
  const { exp, ...safe } = user;
  return json({ user: safe });
}
