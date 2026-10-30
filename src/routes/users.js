import {pagination,pageInfo} from '../lib/pagination.js';
import { json } from '../lib/http.js';

/** Lista de trabajadores activos (para buscadores y formularios del administrador). ?q=nombre|código */
export async function list({ env, url }) {
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 60);
  const fields = `SELECT T.ID_Trabajador AS id, T.Codigo_Trabajador AS codigo, E.Nombre_Completo AS nombre, T.Rol_Cargo AS cargo
               FROM Trabajadores T JOIN Empleados E ON E.ID_Empleado = T.ID_Empleado
               LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado
               WHERE E.Estado = 'Activo' AND COALESCE(C.Rol,'trabajador')='trabajador' ${q ? 'AND (E.Nombre_Completo LIKE ? OR T.Codigo_Trabajador LIKE ?)' : ''}
               `;
  const from=fields.slice(fields.indexOf('FROM Trabajadores')),args=q?[`%${q}%`,`%${q}%`]:[],pg=pagination(url.searchParams);
  const {n}=await env.DB.prepare('SELECT COUNT(*) n '+from).bind(...args).first(),meta=pageInfo(n,pg);
  const {results}=await env.DB.prepare(fields+' ORDER BY E.Nombre_Completo,T.ID_Trabajador LIMIT ? OFFSET ?').bind(...args,pg.limit,meta.offset).all();
  return json({users:results,...meta});
}
