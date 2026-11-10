import {pagination,pageInfo} from '../lib/pagination.js';
import { json, HttpError } from '../lib/http.js';

/** Lista de trabajadores activos (para buscadores y formularios del administrador). ?q=nombre|código */
export async function list({ env, url }) {
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 60);
  const area=url.searchParams.get('area');
  if(area!==null && area!=='sin-area' && (!/^[1-9]\d*$/.test(area)||!Number.isSafeInteger(Number(area))))throw new HttpError(400,'Área no válida.');
  const fields = `SELECT T.ID_Trabajador AS id, T.Codigo_Trabajador AS codigo, E.ID_Empleado AS empleado_id,
                  E.Nombre_Completo AS nombre, T.Rol_Cargo AS cargo,
                  EXISTS(SELECT 1 FROM Fotos_Usuario F WHERE F.ID_Empleado=E.ID_Empleado) AS tiene_foto,
                  (SELECT A.Nombre FROM Empleados_Area EA JOIN Areas_Trabajo A ON A.ID_Area=EA.ID_Area WHERE EA.ID_Empleado=E.ID_Empleado ORDER BY A.Nombre LIMIT 1) AS area
               FROM Trabajadores T JOIN Empleados E ON E.ID_Empleado = T.ID_Empleado
               LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado
               LEFT JOIN Empleados_Area EA ON EA.ID_Empleado=E.ID_Empleado
               WHERE E.Estado = 'Activo' AND COALESCE(C.Rol,'trabajador')='trabajador' ${q ? 'AND (E.Nombre_Completo LIKE ? OR T.Codigo_Trabajador LIKE ?)' : ''} ${area==='sin-area'?'AND EA.ID_Area IS NULL':area?'AND EA.ID_Area = ?':''}
               `;
  const from=fields.slice(fields.indexOf('FROM Trabajadores')),args=[...(q?[`%${q}%`,`%${q}%`]:[]),...(area && area!=='sin-area'?[Number(area)]:[])],pg=pagination(url.searchParams);
  const {n}=await env.DB.prepare('SELECT COUNT(*) n '+from).bind(...args).first(),meta=pageInfo(n,pg);
  const {results}=await env.DB.prepare(fields+' ORDER BY E.Nombre_Completo,T.ID_Trabajador LIMIT ? OFFSET ?').bind(...args,pg.limit,meta.offset).all();
  return json({users:results,...meta});
}
