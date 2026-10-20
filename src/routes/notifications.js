import { HttpError, intParam, json, readJson } from '../lib/http.js';
const fields=`ID_Notificacion AS id,ID_Tarea AS tarea_id,Tipo AS tipo,Nombre_Tarea AS nombre,
 Descripcion AS descripcion,Fecha_Entrega AS fecha_entrega,Estado AS estado,Observaciones AS observaciones,Fecha_Evento AS fecha`;
export async function list({env,user,url}) {
 const p=url.searchParams, since=intParam(p.get('since'),{min:0}), before=intParam(p.get('before'),{min:1});
 if(since!==null && before!==null)throw new HttpError(400,'Usa since o before, no ambos.');
 const limit=intParam(p.get('limit'),{min:1,max:100,fallback:40});
 const hidden=(await env.DB.prepare('SELECT Ocultas_Hasta AS n FROM Notificaciones_Lectura WHERE ID_Empleado=?').bind(user.empleado_id).first())?.n||0;
 const where=['ID_Empleado=?','ID_Notificacion>?'], binds=[user.empleado_id,Math.max(hidden,since??0)];
 if(before!==null){where.push('ID_Notificacion<?');binds.push(before);}
 const {results}=await env.DB.prepare(`SELECT ${fields} FROM Notificaciones_Tarea WHERE ${where.join(' AND ')} ORDER BY ID_Notificacion ${since!==null?'ASC':'DESC'} LIMIT ?`).bind(...binds,limit+1).all();
 const has_more=results.length>limit, rows=results.slice(0,limit);
 const cursor=Math.max(hidden,since??0,...rows.map(x=>x.id));
 return json({notifications:rows,cursor,has_more,next_before:rows.length?Math.min(...rows.map(x=>x.id)):null,cleared_through:hidden});
}
export async function clear({env,user,request}) {
 const b=await readJson(request),through=intParam(b.through_id,{min:0});
 if(through===null)throw new HttpError(400,'Falta el límite de notificaciones.');
 // Nunca ocultar IDs futuros ni notificaciones de otra persona.
 await env.DB.prepare(`INSERT INTO Notificaciones_Lectura(ID_Empleado,Ocultas_Hasta)
 SELECT ?,MIN(?,COALESCE(MAX(ID_Notificacion),0)) FROM Notificaciones_Tarea WHERE ID_Empleado=?
 ON CONFLICT(ID_Empleado) DO UPDATE SET Ocultas_Hasta=MAX(Ocultas_Hasta,excluded.Ocultas_Hasta)`).bind(user.empleado_id,through,user.empleado_id).run();
 const hidden=(await env.DB.prepare('SELECT Ocultas_Hasta AS n FROM Notificaciones_Lectura WHERE ID_Empleado=?').bind(user.empleado_id).first()).n;
 return json({cleared_through:hidden});
}
