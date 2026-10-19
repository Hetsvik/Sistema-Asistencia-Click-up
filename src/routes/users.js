import { json } from '../lib/http.js';

/** Lista de trabajadores activos (para buscadores y formularios del administrador). ?q=nombre|código */
export async function list({ env, url }) {
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 60);
  const sql = `SELECT T.ID_Trabajador AS id, T.Codigo_Trabajador AS codigo, E.Nombre_Completo AS nombre, T.Rol_Cargo AS cargo
               FROM Trabajadores T JOIN Empleados E ON E.ID_Empleado = T.ID_Empleado
               LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado
               WHERE E.Estado = 'Activo' AND COALESCE(C.Rol,'trabajador')='trabajador' ${q ? 'AND (E.Nombre_Completo LIKE ? OR T.Codigo_Trabajador LIKE ?)' : ''}
               ORDER BY E.Nombre_Completo LIMIT 100`;
  const stmt = env.DB.prepare(sql);
  const { results } = await (q ? stmt.bind(`%${q}%`, `%${q}%`) : stmt).all();
  return json({ users: results });
}
