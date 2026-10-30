import { HttpError, intParam, json } from '../lib/http.js';
import { monthRange, nowLocal, weekRange, workdaysBetween } from '../lib/dates.js';

import { punctuality,peruNow } from '../lib/attendance-policy.js';

const PERIODOS = ['semana', 'mes', 'todo'];

/**
 * GET /api/reports/summary?periodo=semana|mes|todo[&trabajador=ID]
 * - Trabajador: siempre sus propios datos.
 * - Administrador: un trabajador (?trabajador=) o el total de la empresa.
 */
export async function summary({ env, user, url, tz }) {
  const p = url.searchParams;
  const periodo = p.get('periodo') ?? 'mes';
  if (!PERIODOS.includes(periodo)) throw new HttpError(400, 'Periodo no válido (semana, mes, todo).');

  const hoy = peruNow().fecha;
  const rango = periodo === 'semana' ? weekRange(hoy) : periodo === 'mes' ? monthRange(hoy) : { desde: '0000-01-01', hasta: '9999-12-31' };

  let trabajadorId = null;
  let trabajador = null;
  if (user.rol === 'trabajador') {
    trabajadorId = user.id;
  } else {
    trabajadorId = intParam(p.get('trabajador'), { min: 1 });
  }
  if (trabajadorId) {
    trabajador = await env.DB.prepare(
      'SELECT T.ID_Trabajador AS id, E.Nombre_Completo AS nombre FROM Trabajadores T JOIN Empleados E ON E.ID_Empleado = T.ID_Empleado WHERE T.ID_Trabajador = ?',
    ).bind(trabajadorId).first();
    if (!trabajador) throw new HttpError(404, 'Trabajador no encontrado.');
  }
  const filtro = trabajadorId ? ' AND ID_Trabajador = ?' : '';
  const extra = trabajadorId ? [trabajadorId] : [];

  const asistencia = await env.DB.prepare(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(Estado_Asistencia = 'A tiempo'), 0) AS a_tiempo,
            COALESCE(SUM(Estado_Asistencia = 'Tardanza'), 0) AS tardanzas
     FROM Asistencia WHERE Fecha_Calculada BETWEEN ? AND ?${filtro}`,
  ).bind(rango.desde, rango.hasta, ...extra).first();

  // Asistencias esperadas = días hábiles transcurridos × trabajadores considerados.
  let esperadas = null;
  if (periodo !== 'todo') {
    const hasta = hoy < rango.hasta ? hoy : rango.hasta;
    const dias = hasta < rango.desde ? 0 : workdaysBetween(rango.desde, hasta);
    const n = trabajadorId ? 1 : (await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM Trabajadores T JOIN Empleados E ON E.ID_Empleado = T.ID_Empleado WHERE E.Estado = 'Activo'",
    ).first()).n;
    esperadas = dias * n;
  }

  const prioridad=p.get('prioridad')||'';
  if(prioridad&&!['Alta','Media','Baja'].includes(prioridad))throw new HttpError(400,'Prioridad no válida.');
  const taskWhere=`T.Fecha BETWEEN ? AND ?${trabajadorId?' AND T.ID_Trabajador=?':''}${prioridad?' AND D.Prioridad=?':''}`;
  const taskBinds=[rango.desde,rango.hasta,...extra,...(prioridad?[prioridad]:[])];
  const {results:prioridades}=await env.DB.prepare(`SELECT COALESCE(D.Prioridad,'Sin prioridad') prioridad,COUNT(*) total,SUM(T.Estado_Tarea='Completada') completadas FROM Tareas T LEFT JOIN Tareas_Detalle D ON D.ID_Tarea=T.ID_Tarea WHERE ${taskWhere} GROUP BY COALESCE(D.Prioridad,'Sin prioridad')`).bind(...taskBinds).all();
  const filtered=await env.DB.prepare(`SELECT COUNT(*) total,COALESCE(SUM(T.Estado_Tarea='Asignada'),0) asignadas,COALESCE(SUM(T.Estado_Tarea='En Progreso'),0) en_progreso,COALESCE(SUM(T.Estado_Tarea='En revisión'),0) en_revision,COALESCE(SUM(T.Estado_Tarea='Completada'),0) completadas,COALESCE(SUM(T.Observaciones LIKE '%FUERA DE PLAZO%'),0) fuera_de_plazo FROM Tareas T LEFT JOIN Tareas_Detalle D ON D.ID_Tarea=T.ID_Tarea WHERE ${taskWhere}`).bind(...taskBinds).first();
  if(p.get('detalle')==='1'&&filtered.total>10000)throw new HttpError(413,'Demasiadas tareas para exportar. Selecciona un trabajador y un periodo menor.');
  const puntualidad=await punctuality(env.DB,{desde:rango.desde,hasta:rango.hasta,workerId:trabajadorId,includeDetails:p.get('detalle')==='1'});
  let tareas_detalle;
  if(p.get('detalle')==='1'){
   if(filtered.total>10000||puntualidad.detalle.length>50000)throw new HttpError(413,'Demasiados datos para una exportación. Selecciona un trabajador y un periodo menor.');
   tareas_detalle=(await env.DB.prepare(`SELECT T.ID_Tarea tarea_id,T.ID_Trabajador trabajador_id,E.Nombre_Completo nombre,P.Nombre_Proyecto proyecto,T.Descripcion_Tarea descripcion,T.Fecha fecha,T.Fecha_Entrega entrega,T.Estado_Tarea estado,COALESCE(D.Prioridad,'Sin prioridad') prioridad FROM Tareas T JOIN Trabajadores W ON W.ID_Trabajador=T.ID_Trabajador JOIN Empleados E ON E.ID_Empleado=W.ID_Empleado JOIN Proyectos P ON P.ID_Proyecto=T.ID_Proyecto LEFT JOIN Tareas_Detalle D ON D.ID_Tarea=T.ID_Tarea WHERE ${taskWhere} ORDER BY T.Fecha,T.ID_Tarea`).bind(...taskBinds).all()).results;
  }
  return json({
    periodo: { clave: periodo, ...rango }, filtros:{prioridad},
    trabajador,
    asistencia: { ...asistencia, esperadas },
    tareas:filtered, prioridades, puntualidad:puntualidad.resumen,
    ...(tareas_detalle?{tareas_detalle,puntualidad_detalle:puntualidad.detalle}:{}),
    eficiencia:filtered.total?Math.round(filtered.completadas/filtered.total*1000)/10:0,
  });
}
