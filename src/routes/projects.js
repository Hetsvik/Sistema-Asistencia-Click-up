import { HttpError, intParam, json, readJson, text } from '../lib/http.js';
import { nowLocal } from '../lib/dates.js';
const active=`NOT EXISTS(SELECT 1 FROM Proyectos_Control C WHERE C.ID_Proyecto=P.ID_Proyecto AND C.Eliminado_En IS NOT NULL)`;
const fields=`P.ID_Proyecto AS id,P.Nombre_Proyecto AS nombre,P.Area_Departamento AS area,COALESCE(D.Descripcion,'') AS descripcion,D.Fecha_Programada AS fecha,D.Fecha_Creacion AS creado`;
const from=`FROM Proyectos P LEFT JOIN Proyectos_Detalle D ON D.ID_Proyecto=P.ID_Proyecto`;
export async function list({env,url}) {
 const p=url.searchParams,q=(p.get('q')||'').trim().slice(0,120),where=[active],binds=[];
 if(q){where.push('(P.Nombre_Proyecto LIKE ? OR P.Area_Departamento LIKE ? OR D.Descripcion LIKE ?)');binds.push(...Array(3).fill('%'+q+'%'));}
 const order=p.get('order')||'desc';if(!['asc','desc'].includes(order))throw new HttpError(400,'Orden no válido.');
 const limit=intParam(p.get('limit'),{min:1,max:500,fallback:p.has('page')?10:200});
 if(p.has('page')){
  if(p.has('before'))throw new HttpError(400,'Usa página o cursor, no ambos.');
  const requested=intParam(p.get('page'),{min:1,max:1000000});
  const count=await env.DB.prepare(`SELECT COUNT(*) AS total ${from} WHERE ${where.join(' AND ')}`).bind(...binds).first();
  const pages=Math.max(1,Math.ceil(count.total/limit)),page=Math.min(requested,pages);
  const {results}=await env.DB.prepare(`SELECT ${fields} ${from} WHERE ${where.join(' AND ')} ORDER BY P.ID_Proyecto ${order} LIMIT ? OFFSET ?`).bind(...binds,limit,(page-1)*limit).all();
  return json({projects:results,total:count.total,page,pages,has_more:page<pages});
 }
 // Compatibilidad con el catálogo paginado del formulario de tareas.
 const before=intParam(p.get('before'),{min:1});
 if(before!==null){where.push(`P.ID_Proyecto${order==='desc'?'<':'>'}?`);binds.push(before);}
 const {results}=await env.DB.prepare(`SELECT ${fields} ${from} WHERE ${where.join(' AND ')} ORDER BY P.ID_Proyecto ${order} LIMIT ?`).bind(...binds,limit+1).all();
 return json({projects:results.slice(0,limit),has_more:results.length>limit,next_before:results.length?results[Math.min(results.length,limit)-1].id:null});
}
const values=b=>({nombre:text(b.nombre,{field:'El nombre',max:120}),area:text(b.area,{field:'El área / departamento',max:80}),descripcion:text(b.descripcion,{field:'La descripción',max:2000})});
async function get(env,id){const row=await env.DB.prepare(`SELECT ${fields} ${from} WHERE P.ID_Proyecto=? AND ${active}`).bind(id).first();if(!row)throw new HttpError(404,'Proyecto no encontrado o eliminado.');return row;}
const idOf=params=>{const id=intParam(params.id,{min:1});if(id===null)throw new HttpError(400,'Identificador no válido.');return id;};
export async function detail({env,params}){return json({project:await get(env,idOf(params))});}
export async function create({request,env}) {
 const {nombre,area,descripcion}=values(await readJson(request));const fecha=nowLocal('America/Lima').fechaHora;
 const rows=await env.DB.batch([
 env.DB.prepare('INSERT INTO Proyectos(Nombre_Proyecto,Area_Departamento) VALUES(?,?)').bind(nombre,area),
 env.DB.prepare('INSERT INTO Proyectos_Detalle(ID_Proyecto,Descripcion,Fecha_Programada) VALUES(last_insert_rowid(),?,?)').bind(descripcion,fecha)
 ]);
 return json({message:'Proyecto creado.',project:{id:rows[0].meta.last_row_id,nombre,area,descripcion,fecha}},201);
}
export async function update({request,env,params}){
 const id=idOf(params);await get(env,id);const {nombre,area,descripcion}=values(await readJson(request));
 const rows=await env.DB.batch([
 env.DB.prepare(`UPDATE Proyectos AS P SET Nombre_Proyecto=?,Area_Departamento=? WHERE ID_Proyecto=? AND ${active}`).bind(nombre,area,id),
 env.DB.prepare(`INSERT INTO Proyectos_Detalle(ID_Proyecto,Descripcion) SELECT P.ID_Proyecto,? FROM Proyectos P WHERE P.ID_Proyecto=? AND ${active} ON CONFLICT(ID_Proyecto) DO UPDATE SET Descripcion=excluded.Descripcion`).bind(descripcion,id)
 ]);
 if(!rows[0].meta.changes)throw new HttpError(409,'El proyecto cambió o fue eliminado.');return json({message:'Proyecto actualizado.',project:await get(env,id)});
}
export async function remove({env,params}){
 const id=idOf(params);await get(env,id);
 await env.DB.prepare(`INSERT INTO Proyectos_Control(ID_Proyecto,Eliminado_En) VALUES(?,?) ON CONFLICT(ID_Proyecto) DO UPDATE SET Eliminado_En=COALESCE(Eliminado_En,excluded.Eliminado_En)`).bind(id,nowLocal('America/Lima').fechaHora).run();
 return json({message:'Proyecto eliminado del listado. El historial de tareas se conserva.'});
}