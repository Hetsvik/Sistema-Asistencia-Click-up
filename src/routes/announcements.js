import { HttpError, intParam, json, readJson, text } from '../lib/http.js';
import { nowLocal } from '../lib/dates.js';

export async function list({ env, url }) {
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 160);
  const sort = url.searchParams.get('sort') ?? 'fecha';
  const order = url.searchParams.get('order') ?? 'desc';
  if (!['nombre','fecha'].includes(sort) || !['asc','desc'].includes(order)) throw new HttpError(400, 'Orden no válido.');
  const page = intParam(url.searchParams.get('page'), { min: 1, max: 100000, fallback: 1 });
  const limit = 20;
  const where = q ? 'WHERE Nombre LIKE ? OR Motivo LIKE ?' : '';
  const args = q ? [`%${q}%`, `%${q}%`] : [];
  const total = await env.DB.prepare(`SELECT COUNT(*) AS n FROM Anuncios ${where}`).bind(...args).first();
  const pages = Math.max(1, Math.ceil(total.n / limit));
  const current = Math.min(page, pages);
  const col = sort === 'nombre' ? 'Nombre COLLATE NOCASE' : 'Fecha_Creacion';
  const dir = order === 'asc' ? 'ASC' : 'DESC';
  const { results } = await env.DB.prepare(`SELECT ID_Anuncio AS id, Nombre AS nombre, Motivo AS motivo,
      Fecha_Creacion AS fecha FROM Anuncios ${where} ORDER BY ${col} ${dir}, ID_Anuncio ${dir} LIMIT ? OFFSET ?`)
    .bind(...args, limit, (current - 1) * limit).all();
  return json({ announcements: results, total: total.n, page: current, pages, tz: 'America/Lima' });
}

export async function create({ request, env, user }) {
  const body = await readJson(request);
  const nombre = text(body.nombre, { field: 'Nombre', max: 160 });
  const motivo = text(body.motivo, { field: 'Motivo', max: 5000 });
  // La fecha se obtiene del servidor, siempre en Perú. Se ignoran fechas enviadas por el cliente.
  const fecha = nowLocal('America/Lima').fechaHora;
  const r = await env.DB.prepare('INSERT INTO Anuncios(Nombre,Motivo,Fecha_Creacion,ID_Administrador) VALUES(?,?,?,?)')
    .bind(nombre, motivo, fecha, user.id).run();
  return json({ announcement: { id: r.meta.last_row_id, nombre, motivo, fecha }, tz: 'America/Lima' }, 201);
}
