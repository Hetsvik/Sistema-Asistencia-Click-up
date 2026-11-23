import {pagination,pageInfo} from '../lib/pagination.js';
import {isDate} from '../lib/dates.js';
import { limit } from '../lib/rate-limit.js';
import {commentFiles} from './attachments.js';
import { HttpError, intParam, json, readJson, text } from '../lib/http.js';
import { nowLocal, normalizeDateTime, priorityFor, toMs } from '../lib/dates.js';

const ESTADOS = ['Asignada', 'En Progreso', 'En revisión', 'Completada'];
const LATE_TAG = '[ENTREGADO FUERA DE PLAZO]';

const SELECT = `
  SELECT t.ID_Tarea AS id, t.ID_Trabajador AS trabajador_id, e.Nombre_Completo AS trabajador,
         t.Nombre_Tarea AS nombre_tarea, t.Descripcion_Tarea AS descripcion, t.Fecha AS fecha, t.Fecha_Inicio AS fecha_inicio,
         t.Fecha_Entrega AS fecha_entrega, t.Fecha_Completada AS fecha_completada,
         t.Estado_Tarea AS estado, t.Observaciones AS observaciones, D.Prioridad AS prioridad_manual
  FROM Tareas t
  LEFT JOIN Tareas_Detalle D ON D.ID_Tarea=t.ID_Tarea
  JOIN Trabajadores w ON w.ID_Trabajador = t.ID_Trabajador
  JOIN Empleados e ON e.ID_Empleado = w.ID_Empleado`;

const activeTask = `NOT EXISTS(SELECT 1 FROM Tareas_Control TC WHERE TC.ID_Tarea=t.ID_Tarea)`;
const withPriority = (task, ahora) => ({ ...task, prioridad: task.prioridad_manual || priorityFor(task.fecha_entrega, task.estado, ahora) });

async function loadTask(db, id, user) {
  const task = await db.prepare(`${SELECT} WHERE t.ID_Tarea = ? AND ${activeTask}`).bind(id).first();
  // Un trabajador no puede saber si existen tareas ajenas: responde 404 en ambos casos.
  if (!task || (user.rol === 'trabajador' && task.trabajador_id !== user.id)) throw new HttpError(404, 'Tarea no encontrada.');
  return task;
}

export async function list({ env, user, url, tz }) {
  const p = url.searchParams;
  const history = p.get('historial') === '1';
  const activeOnly = p.get('activas') === '1';
  if (history && activeOnly) throw new HttpError(400, 'Usa historial o activas, no ambos.');
  const where = [activeTask];
  const binds = [];
  const add = (sql, ...values) => { where.push(sql); binds.push(...values); };

  if (history) add("t.Estado_Tarea = 'Completada'");
  else if (activeOnly) add("t.Estado_Tarea <> 'Completada'");

  if (user.rol === 'trabajador') {
    add('t.ID_Trabajador = ?', user.id);
  } else {
    const trabajador = intParam(p.get('trabajador'), { min: 1 });
    if (trabajador) add('t.ID_Trabajador = ?', trabajador);
  }
  const estado = p.get('estado');
  if (estado) {
    if (!ESTADOS.includes(estado)) throw new HttpError(400, 'Estado no válido.');
    if (history && estado !== 'Completada' || activeOnly && estado === 'Completada') throw new HttpError(400, 'El estado no corresponde a esta vista.');
    add('t.Estado_Tarea = ?', estado);
  }
  const q = (p.get('q') ?? '').trim().slice(0, 60);
  if (q) add('(t.Nombre_Tarea LIKE ? OR t.Descripcion_Tarea LIKE ? OR e.Nombre_Completo LIKE ?)', `%${q}%`, `%${q}%`, `%${q}%`);

  const calendar = p.get('calendar');
  const notifications = p.get('notifications');
  if (calendar !== null) {
    if (!/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(calendar)) throw new HttpError(400, 'Mes de calendario no válido.');
    const first = new Date(`${calendar}-01T00:00:00Z`);
    first.setUTCDate(1 - (first.getUTCDay()+6)%7);
    const after = new Date(first); after.setUTCDate(after.getUTCDate()+42);
    add('t.Fecha_Entrega >= ? AND t.Fecha_Entrega < ?', first.toISOString().slice(0,10)+' 00:00:00', after.toISOString().slice(0,10)+' 00:00:00');
  }
  if (notifications !== null) {
    if (notifications !== '1') throw new HttpError(400, 'Filtro de notificaciones no válido.');
    const cutoff = new Date(toMs(nowLocal(tz).fechaHora)+24*60*60*1000).toISOString().slice(0,19).replace('T',' ');
    add("t.Estado_Tarea <> 'Completada' AND t.Fecha_Entrega <= ?", cutoff);
  }
  const day=p.get('dia');if(day){if(!isDate(day))throw new HttpError(400,'Día no válido.');add('t.Fecha_Entrega>=? AND t.Fecha_Entrega<?',day+' 00:00:00',day+' 24:00:00');}
  const fromDate=p.get('desde'),toDate=p.get('hasta');
  if(history){
    if(fromDate&&!isDate(fromDate)||toDate&&!isDate(toDate))throw new HttpError(400,'El intervalo de fechas no es válido.');
    if(fromDate&&toDate&&fromDate>toDate)throw new HttpError(400,'La fecha inicial no puede ser posterior a la fecha final.');
    const historyDate="substr(COALESCE(t.Fecha_Completada,t.Fecha_Entrega,t.Fecha),1,10)";
    if(fromDate)add(`${historyDate} >= ?`,fromDate);
    if(toDate)add(`${historyDate} <= ?`,toDate);
  }else if(fromDate!==null||toDate!==null)throw new HttpError(400,'El intervalo de fechas solo se usa en el historial.');
  const from=SELECT.slice(SELECT.indexOf('  FROM Tareas'));
  const condition=where.length?'WHERE '+where.join(' AND '):'';
  if(p.get('resumen')==='1'){
   const stats=await env.DB.prepare(`SELECT COUNT(*) total,COALESCE(SUM(t.Estado_Tarea<>'Completada'),0) pendientes ${from} ${condition}`).bind(...binds).first();return json(stats);
  }
  if(calendar!==null&&p.get('vista')==='resumen'){
   const {results:days}=await env.DB.prepare(`SELECT substr(t.Fecha_Entrega,1,10) fecha,COUNT(*) total ${from} ${condition} GROUP BY substr(t.Fecha_Entrega,1,10)`).bind(...binds).all();return json({days});
  }
  const pg=pagination(p,history?{size:10,max:10}:{}),count=await env.DB.prepare(`SELECT COUNT(*) n ${from} ${condition}`).bind(...binds).first(),meta=pageInfo(count.n,pg);
  const limit=pg.limit;
  const sql = `${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
               ORDER BY ${history?'COALESCE(t.Fecha_Completada,t.Fecha_Entrega,t.Fecha) DESC, t.ID_Tarea DESC':"(t.Estado_Tarea = 'Completada'), t.Fecha_Entrega ASC, t.ID_Tarea ASC"} LIMIT ? OFFSET ?`;
  const { results } = await env.DB.prepare(sql).bind(...binds, limit,meta.offset).all();
  const ahora = nowLocal(tz).fechaHora;
  return json({ tasks: results.map((t) => ({...withPriority(t, ahora),fecha_historial:t.fecha_completada||t.fecha_entrega||t.fecha})),...meta });
}

export async function detail({ env, user, params, tz }) {
  const task = await loadTask(env.DB, intParam(params.id, { min: 1 }), user);
  return json({ task: withPriority(task, nowLocal(tz).fechaHora) });
}

export async function create({ request, env, user, tz }) {
  const b = await readJson(request);
  const ahora = nowLocal(tz);
  const prioridad = b.prioridad ?? null;
  if (prioridad !== null && !['Alta','Media','Baja'].includes(prioridad)) throw new HttpError(400,'Prioridad no válida.');

  const rawIds = Array.isArray(b.trabajador_ids) ? b.trabajador_ids : [b.trabajador_id];
  if (!rawIds.length || rawIds.length > 50) throw new HttpError(400, 'Selecciona entre 1 y 50 trabajadores.');
  const workerIds = rawIds.map(v => { const n=Number(v); return Number.isSafeInteger(n)&&n>0?n:null; });
  if(workerIds.some(x=>x===null)||new Set(workerIds).size!==workerIds.length)throw new HttpError(400,'Trabajadores no válidos o duplicados.');
  for(const trabajadorId of workerIds){
   const worker=await env.DB.prepare(`SELECT T.ID_Trabajador FROM Trabajadores T JOIN Empleados E ON E.ID_Empleado=T.ID_Empleado LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado WHERE T.ID_Trabajador=? AND E.Estado='Activo' AND COALESCE(C.Rol,'trabajador')='trabajador'`).bind(trabajadorId).first();
   if(!worker)throw new HttpError(400,'Un trabajador no existe o está inactivo.');
  }

  const nombre = text(b.nombre_tarea, { field: 'El nombre de la tarea', max: 120 });
  const descripcion = text(b.descripcion, { field: 'La descripción', max: 500 });
  const entrega = normalizeDateTime(b.fecha_entrega);
  if (!entrega) throw new HttpError(400, 'La fecha de entrega no es válida.');
  const inicio = b.fecha_inicio ? normalizeDateTime(b.fecha_inicio) : ahora.fechaHora;
  if (!inicio) throw new HttpError(400, 'La fecha de inicio no es válida.');
  if (toMs(entrega) < toMs(inicio)) throw new HttpError(400, 'La entrega no puede ser anterior al inicio.');

  const statements=[];
  for(const trabajadorId of workerIds){
    statements.push(env.DB.prepare(`INSERT INTO Tareas (ID_Trabajador,ID_Administrador_Asignador,Nombre_Tarea,Fecha,Fecha_Inicio,Fecha_Entrega,Descripcion_Tarea)
      VALUES ((SELECT T.ID_Trabajador FROM Trabajadores T JOIN Empleados E ON E.ID_Empleado=T.ID_Empleado LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado WHERE T.ID_Trabajador=? AND E.Estado='Activo' AND COALESCE(C.Rol,'trabajador')='trabajador'),?,?,?,?,?,?)`).bind(trabajadorId,user.id,nombre,ahora.fecha,inicio,entrega,descripcion));
    statements.push(env.DB.prepare('UPDATE Tareas_Detalle SET Prioridad=? WHERE ID_Tarea=last_insert_rowid()').bind(prioridad));
  }
  let results;try{results=await env.DB.batch(statements);}catch(err){if(String(err).includes('NOT NULL constraint failed: Tareas.ID_Trabajador'))throw new HttpError(409,'Un trabajador dejó de estar activo. Actualiza la selección.');throw err;}
  const task=await loadTask(env.DB,results[0].meta.last_row_id,user);
  return json({message:workerIds.length===1?'Tarea creada.':`${workerIds.length} tareas creadas.`,task:withPriority(task,ahora.fechaHora),created_count:workerIds.length},201);
}

export async function updateStatus({ request, env, user, params, tz }) {
  const id = intParam(params.id, { min: 1 });
  const b = await readJson(request);
  if (!ESTADOS.includes(b.estado)) throw new HttpError(400, `Estado no válido. Usa: ${ESTADOS.join(', ')}.`);
  const task = await loadTask(env.DB, id, user);
  if(b.expected_estado !== undefined && b.expected_estado !== task.estado) throw new HttpError(409,'La tarea cambió. Vuelve a abrirla antes de resolver la entrega.');

  const next = user.rol === 'trabajador'
    ? {Asignada:['En Progreso'],'En Progreso':['En revisión'],'En revisión':[],Completada:[]}
    : {Asignada:['En Progreso'],'En Progreso':['En revisión'],'En revisión':['Completada','En Progreso'],Completada:['En Progreso']};
  if (user.rol === 'trabajador' && b.estado === 'Completada') throw new HttpError(403,'Solo un administrador puede aprobar la entrega.');
  if (b.estado !== task.estado && !next[task.estado]?.includes(b.estado)) throw new HttpError(409,'El cambio de estado no está permitido.');
  if (user.rol === 'trabajador' && b.estado === task.estado) throw new HttpError(409,'La tarea ya tiene ese estado.');
  if (task.estado === 'En revisión' && b.estado === 'En Progreso' && !(typeof b.observaciones==='string' && b.observaciones.trim())) throw new HttpError(400,'Indica el motivo para devolver la tarea.');

  const ahora = nowLocal(tz).fechaHora;
  let obs = b.observaciones === undefined ? (task.observaciones ?? '') : (text(b.observaciones, { field: 'Las observaciones', max: 500, required: false }) ?? '');
  if (b.estado === 'En revisión' && task.fecha_entrega && toMs(ahora) > toMs(task.fecha_entrega) && !obs.includes(LATE_TAG)) {
    obs = `${LATE_TAG} ${obs}`.trim();
  }
  const changed = await env.DB.prepare('UPDATE Tareas SET Estado_Tarea = ?, Observaciones = ?, Fecha_Completada = CASE WHEN ? = \'Completada\' THEN COALESCE(Fecha_Completada, ?) ELSE NULL END WHERE ID_Tarea = ? AND Estado_Tarea = ? AND NOT EXISTS(SELECT 1 FROM Tareas_Control C WHERE C.ID_Tarea=Tareas.ID_Tarea)').bind(b.estado, obs, b.estado, b.estado === 'Completada' ? ahora.fechaHora : null, id, task.estado).run();
  if (!changed.meta.changes) throw new HttpError(409,'La tarea cambió. Vuelve a abrirla e inténtalo de nuevo.');
  return json({ message: 'Estado actualizado.', task: withPriority(await loadTask(env.DB, id, user), ahora) });
}

// Cambia campos de la tarea sin reasignar: el historial de chat y archivos sigue siendo privado.
export async function edit({request,env,user,params}) {
 const id=intParam(params.id,{min:1}),b=await readJson(request),task=await loadTask(env.DB,id,user);
 const name=text(b.nombre_tarea,{field:'El nombre de la tarea',max:120});
 const description=text(b.descripcion,{field:'La descripción',max:500});
 const deadline=normalizeDateTime(b.fecha_entrega);
 if(!deadline)throw new HttpError(400,'La fecha de entrega no es válida.');
 if(task.fecha_inicio && toMs(deadline)<toMs(task.fecha_inicio))throw new HttpError(400,'La entrega no puede ser anterior al inicio.');
 if(!['Alta','Media','Baja'].includes(b.prioridad))throw new HttpError(400,'Prioridad no válida.');
 if(!b.expected || b.expected.nombre_tarea!==task.nombre_tarea || b.expected.descripcion!==task.descripcion || b.expected.fecha_entrega!==task.fecha_entrega || b.expected.prioridad_manual!==(task.prioridad_manual??null)) throw new HttpError(409,'La tarea cambió. Vuelve a abrir el formulario.');
 const result=await env.DB.batch([
  env.DB.prepare(`UPDATE Tareas SET Nombre_Tarea=?,Descripcion_Tarea=?,Fecha_Entrega=? WHERE ID_Tarea=? AND Nombre_Tarea=? AND Descripcion_Tarea=? AND Fecha_Entrega IS ? AND NOT EXISTS(SELECT 1 FROM Tareas_Control C WHERE C.ID_Tarea=Tareas.ID_Tarea) AND (SELECT Prioridad FROM Tareas_Detalle WHERE ID_Tarea=Tareas.ID_Tarea) IS ?`).bind(name,description,deadline,id,task.nombre_tarea,task.descripcion,task.fecha_entrega,task.prioridad_manual??null),
  env.DB.prepare('UPDATE Tareas_Detalle SET Prioridad=? WHERE ID_Tarea=? AND changes()=1').bind(b.prioridad,id),
 ]);
 if(!result[0].meta.changes)throw new HttpError(409,'La tarea cambió. Vuelve a abrir el formulario.');
 return json({message:'Tarea actualizada.',task:withPriority(await loadTask(env.DB,id,user),nowLocal('America/Lima').fechaHora)});
}
export async function remove({env,user,params}){
 const id=intParam(params.id,{min:1});await loadTask(env.DB,id,user);
 const res=await env.DB.prepare(`INSERT OR IGNORE INTO Tareas_Control(ID_Tarea,Eliminada_En,Eliminada_Por) SELECT ID_Tarea,?,? FROM Tareas WHERE ID_Tarea=?`).bind(new Date().toISOString(),user.empleado_id,id).run();
 if(!res.meta.changes)throw new HttpError(409,'La tarea ya fue eliminada.');
 return json({message:'Tarea eliminada de las vistas. Se conserva el historial de forma privada.'});
}

export async function comments({ env, user, params, url }) {
  const id = intParam(params.id, { min: 1 });
  await loadTask(env.DB, id, user);
  const before=intParam(url.searchParams.get('before'),{min:1}),after=intParam(url.searchParams.get('after'),{min:0});
  if(before!==null&&after!==null)throw new HttpError(400,'Usa before o after, no ambos.');
  const ascending=after!==null;
  const {results}=await env.DB.prepare(`SELECT ID_Comentario AS id,Autor AS autor,Rol AS rol,Mensaje AS mensaje,strftime('%Y-%m-%dT%H:%M:%SZ',Fecha) AS fecha FROM Comentarios_Tarea WHERE ID_Tarea=? ${before!==null?'AND ID_Comentario<?':after!==null?'AND ID_Comentario>?':''} ORDER BY ID_Comentario ${ascending?'ASC':'DESC'} LIMIT 51`).bind(id,...(before!==null?[before]:after!==null?[after]:[])).all();
  const more=results.length>50,rows=results.slice(0,50);if(!ascending)rows.reverse();
  const files=await commentFiles(env.DB,id,rows.map(c=>c.id));
  return json({comments:rows.map(c=>({...c,attachments:files.filter(f=>f.comment_id===c.id)})),has_more:more,before:rows[0]?.id??null,after:rows.at(-1)?.id??null});
}

export async function addComment({ request, env, user, params }) {
  const id = intParam(params.id, { min: 1 });
  await loadTask(env.DB, id, user);
  await limit(env.DB,'chat',String(user.empleado_id),20,60);
  const b = await readJson(request);
  const mensaje = text(b.mensaje, { field: 'El mensaje', max: 1000 });
  const rol = user.rol === 'admin' ? 'Administrador' : 'Empleado';
  const result=await env.DB.prepare('INSERT INTO Comentarios_Tarea (ID_Tarea, Autor, Rol, Mensaje) SELECT ID_Tarea,?,?,? FROM Tareas WHERE ID_Tarea=? AND NOT EXISTS(SELECT 1 FROM Tareas_Control C WHERE C.ID_Tarea=Tareas.ID_Tarea)').bind(user.nombre,rol,mensaje,id).run();
  if(!result.meta.changes)throw new HttpError(404,'Tarea no encontrada.');
  return json({ message: 'Comentario añadido.' }, 201);
}
