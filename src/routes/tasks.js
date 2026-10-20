import { HttpError, intParam, json, readJson, text } from '../lib/http.js';
import { nowLocal, normalizeDateTime, priorityFor, toMs } from '../lib/dates.js';

const ESTADOS = ['Asignada', 'En Progreso', 'En revisión', 'Completada'];
const LATE_TAG = '[ENTREGADO FUERA DE PLAZO]';

const SELECT = `
  SELECT t.ID_Tarea AS id, t.ID_Trabajador AS trabajador_id, e.Nombre_Completo AS trabajador,
         t.ID_Proyecto AS proyecto_id, p.Nombre_Proyecto AS proyecto, p.Area_Departamento AS area,
         t.Descripcion_Tarea AS descripcion, t.Fecha AS fecha, t.Fecha_Inicio AS fecha_inicio,
         t.Fecha_Entrega AS fecha_entrega, t.Estado_Tarea AS estado, t.Observaciones AS observaciones, D.Prioridad AS prioridad_manual
  FROM Tareas t
  LEFT JOIN Tareas_Detalle D ON D.ID_Tarea=t.ID_Tarea
  JOIN Proyectos p ON p.ID_Proyecto = t.ID_Proyecto
  JOIN Trabajadores w ON w.ID_Trabajador = t.ID_Trabajador
  JOIN Empleados e ON e.ID_Empleado = w.ID_Empleado`;

const withPriority = (task, ahora) => ({ ...task, prioridad: task.prioridad_manual || priorityFor(task.fecha_entrega, task.estado, ahora) });

async function loadTask(db, id, user) {
  const task = await db.prepare(`${SELECT} WHERE t.ID_Tarea = ?`).bind(id).first();
  // Un trabajador no puede saber si existen tareas ajenas: responde 404 en ambos casos.
  if (!task || (user.rol === 'trabajador' && task.trabajador_id !== user.id)) throw new HttpError(404, 'Tarea no encontrada.');
  return task;
}

export async function list({ env, user, url, tz }) {
  const p = url.searchParams;
  const where = [];
  const binds = [];
  const add = (sql, ...values) => { where.push(sql); binds.push(...values); };

  if (user.rol === 'trabajador') {
    add('t.ID_Trabajador = ?', user.id);
  } else {
    const trabajador = intParam(p.get('trabajador'), { min: 1 });
    if (trabajador) add('t.ID_Trabajador = ?', trabajador);
  }
  const estado = p.get('estado');
  if (estado) {
    if (!ESTADOS.includes(estado)) throw new HttpError(400, 'Estado no válido.');
    add('t.Estado_Tarea = ?', estado);
  }
  const q = (p.get('q') ?? '').trim().slice(0, 60);
  if (q) add('(p.Nombre_Proyecto LIKE ? OR t.Descripcion_Tarea LIKE ? OR e.Nombre_Completo LIKE ?)', `%${q}%`, `%${q}%`, `%${q}%`);

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
  const limit = intParam(p.get('limit'), { min: 1, max: 500, fallback: 200 });
  const sql = `${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
               ORDER BY (t.Estado_Tarea = 'Completada'), t.Fecha_Entrega ASC, t.ID_Tarea ASC ${calendar !== null || notifications !== null ? '' : 'LIMIT ?'}`;
  const { results } = await env.DB.prepare(sql).bind(...binds, ...(calendar !== null || notifications !== null ? [] : [limit])).all();
  const ahora = nowLocal(tz).fechaHora;
  return json({ tasks: results.map((t) => withPriority(t, ahora)) });
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

  const trabajadorId = intParam(b.trabajador_id, { min: 1 });
  if (!trabajadorId) throw new HttpError(400, 'Selecciona un trabajador.');
  const worker = await env.DB.prepare(
    `SELECT T.ID_Trabajador FROM Trabajadores T JOIN Empleados E ON E.ID_Empleado = T.ID_Empleado
     LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado
     WHERE T.ID_Trabajador = ? AND E.Estado = 'Activo' AND COALESCE(C.Rol,'trabajador')='trabajador'`,
  ).bind(trabajadorId).first();
  if (!worker) throw new HttpError(400, 'El trabajador no existe o está inactivo.');

  const descripcion = text(b.descripcion, { field: 'La descripción', max: 500 });
  const entrega = normalizeDateTime(b.fecha_entrega);
  if (!entrega) throw new HttpError(400, 'La fecha de entrega no es válida.');
  const inicio = b.fecha_inicio ? normalizeDateTime(b.fecha_inicio) : ahora.fechaHora;
  if (!inicio) throw new HttpError(400, 'La fecha de inicio no es válida.');
  if (toMs(entrega) < toMs(inicio)) throw new HttpError(400, 'La entrega no puede ser anterior al inicio.');

  let proyectoId = intParam(b.proyecto_id, { min: 1 });
  if (proyectoId) {
    if (!(await env.DB.prepare('SELECT 1 AS ok FROM Proyectos P WHERE P.ID_Proyecto = ? AND NOT EXISTS(SELECT 1 FROM Proyectos_Control C WHERE C.ID_Proyecto=P.ID_Proyecto AND C.Eliminado_En IS NOT NULL)').bind(proyectoId).first())) {
      throw new HttpError(400, 'El proyecto no existe.');
    }
  } else if (b.proyecto_nuevo && typeof b.proyecto_nuevo === 'object') {
    const nombre = text(b.proyecto_nuevo.nombre, { field: 'El nombre del proyecto', max: 120 });
    const area = text(b.proyecto_nuevo.area, { field: 'El área', max: 80 });
    const [res] = await env.DB.batch([env.DB.prepare('INSERT INTO Proyectos (Nombre_Proyecto, Area_Departamento) VALUES (?, ?)').bind(nombre, area),env.DB.prepare('INSERT INTO Proyectos_Detalle(ID_Proyecto,Descripcion,Fecha_Programada) VALUES(last_insert_rowid(),?,?)').bind('',nowLocal('America/Lima').fechaHora)]);
    proyectoId = res.meta.last_row_id;
  } else {
    throw new HttpError(400, 'Selecciona o crea un proyecto.');
  }

  const statements = [env.DB.prepare(
    `INSERT INTO Tareas (ID_Trabajador, ID_Administrador_Asignador, ID_Proyecto, Fecha, Fecha_Inicio, Fecha_Entrega, Descripcion_Tarea)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(trabajadorId, user.id, proyectoId, ahora.fecha, inicio, entrega, descripcion),
    env.DB.prepare('UPDATE Tareas_Detalle SET Prioridad=? WHERE ID_Tarea=last_insert_rowid()').bind(prioridad)];
  const [res] = await env.DB.batch(statements);
  const task = await loadTask(env.DB, res.meta.last_row_id, user);
  return json({ message: 'Tarea creada.', task: withPriority(task, ahora.fechaHora) }, 201);
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
  const changed = await env.DB.prepare('UPDATE Tareas SET Estado_Tarea = ?, Observaciones = ? WHERE ID_Tarea = ? AND Estado_Tarea = ?').bind(b.estado, obs, id, task.estado).run();
  if (!changed.meta.changes) throw new HttpError(409,'La tarea cambió. Vuelve a abrirla e inténtalo de nuevo.');
  return json({ message: 'Estado actualizado.', task: withPriority(await loadTask(env.DB, id, user), ahora) });
}

export async function comments({ env, user, params }) {
  const id = intParam(params.id, { min: 1 });
  await loadTask(env.DB, id, user);
  const { results } = await env.DB.prepare(
    'SELECT ID_Comentario AS id, Autor AS autor, Rol AS rol, Mensaje AS mensaje, Fecha AS fecha FROM Comentarios_Tarea WHERE ID_Tarea = ? ORDER BY Fecha ASC, ID_Comentario ASC',
  ).bind(id).all();
  return json({ comments: results });
}

export async function addComment({ request, env, user, params }) {
  const id = intParam(params.id, { min: 1 });
  await loadTask(env.DB, id, user);
  const b = await readJson(request);
  const mensaje = text(b.mensaje, { field: 'El mensaje', max: 1000 });
  const rol = user.rol === 'admin' ? 'Administrador' : 'Empleado';
  await env.DB.prepare('INSERT INTO Comentarios_Tarea (ID_Tarea, Autor, Rol, Mensaje) VALUES (?, ?, ?, ?)').bind(id, user.nombre, rol, mensaje).run();
  return json({ message: 'Comentario añadido.' }, 201);
}

export async function projects({ env }) {
  const { results } = await env.DB.prepare(
    'SELECT ID_Proyecto AS id, Nombre_Proyecto AS nombre, Area_Departamento AS area FROM Proyectos ORDER BY Nombre_Proyecto',
  ).all();
  return json({ projects: results });
}