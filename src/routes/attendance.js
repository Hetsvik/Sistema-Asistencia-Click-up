import { HttpError, intParam, json } from '../lib/http.js';
import { isDate, nowLocal } from '../lib/dates.js';

const SELECT = `
  SELECT a.ID_Asistencia AS id, a.ID_Trabajador AS trabajador_id, e.Nombre_Completo AS nombre,
         a.Fecha_Calculada AS fecha, a.Fecha_Entrada AS entrada, a.Fecha_Salida AS salida,
         a.Estado_Asistencia AS estado
  FROM Asistencia a
  JOIN Trabajadores t ON t.ID_Trabajador = a.ID_Trabajador
  JOIN Empleados e ON e.ID_Empleado = t.ID_Empleado`;

const todayRecord = (db, id, fecha) =>
  db.prepare(`${SELECT} WHERE a.ID_Trabajador = ? AND a.Fecha_Calculada = ?`).bind(id, fecha).first();

export async function today({ env, user, tz }) {
  const ahora = nowLocal(tz);
  return json({ tz, fecha: ahora.fecha, hora: ahora.hora, registro: await todayRecord(env.DB, user.id, ahora.fecha) });
}

export async function checkIn({ env, user, tz }) {
  const ahora = nowLocal(tz);
  if (await todayRecord(env.DB, user.id, ahora.fecha)) throw new HttpError(409, 'Ya registraste tu entrada hoy.');
  try {
    await env.DB.prepare('INSERT INTO Asistencia (ID_Trabajador, Fecha_Entrada) VALUES (?, ?)').bind(user.id, ahora.fechaHora).run();
  } catch (err) {
    if (/UNIQUE/i.test(String(err?.message))) throw new HttpError(409, 'Ya registraste tu entrada hoy.');
    throw err;
  }
  return json({ message: 'Entrada registrada.', registro: await todayRecord(env.DB, user.id, ahora.fecha) }, 201);
}

export async function checkOut({ env, user, tz }) {
  const ahora = nowLocal(tz);
  const res = await env.DB.prepare(
    'UPDATE Asistencia SET Fecha_Salida = ? WHERE ID_Trabajador = ? AND Fecha_Calculada = ? AND Fecha_Salida IS NULL',
  ).bind(ahora.fechaHora, user.id, ahora.fecha).run();
  if (!res.meta?.changes) {
    const existing = await todayRecord(env.DB, user.id, ahora.fecha);
    throw new HttpError(409, existing ? 'Ya registraste tu salida hoy.' : 'Primero debes marcar tu entrada.');
  }
  return json({ message: 'Salida registrada.', registro: await todayRecord(env.DB, user.id, ahora.fecha) });
}

/** Trabajador: solo su historial. Administrador: todos, con filtros ?q=nombre &trabajador=id &desde &hasta */
export async function list({ env, user, url }) {
  const p = url.searchParams;
  const where = [];
  const binds = [];

  if (user.rol === 'trabajador') {
    where.push('a.ID_Trabajador = ?'); binds.push(user.id);
  } else {
    const trabajador = intParam(p.get('trabajador'), { min: 1 });
    if (trabajador) { where.push('a.ID_Trabajador = ?'); binds.push(trabajador); }
    const q = (p.get('q') ?? '').trim().slice(0, 60);
    if (q) { where.push('e.Nombre_Completo LIKE ?'); binds.push(`%${q}%`); }
  }
  for (const [name, op] of [['desde', '>='], ['hasta', '<=']]) {
    const v = p.get(name);
    if (v) {
      if (!isDate(v)) throw new HttpError(400, `La fecha "${name}" no es válida (AAAA-MM-DD).`);
      where.push(`a.Fecha_Calculada ${op} ?`); binds.push(v);
    }
  }
  const limit = intParam(p.get('limit'), { min: 1, max: 200, fallback: 50 });
  const offset = intParam(p.get('offset'), { min: 0, fallback: 0 });
  const sql = `${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
               ORDER BY a.Fecha_Entrada DESC LIMIT ? OFFSET ?`;
  const { results } = await env.DB.prepare(sql).bind(...binds, limit, offset).all();
  return json({ records: results, limit, offset });
}
