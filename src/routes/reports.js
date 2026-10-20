import { HttpError, intParam, json } from '../lib/http.js';
import { monthRange, nowLocal, weekRange, workdaysBetween } from '../lib/dates.js';

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

  const hoy = nowLocal(tz).fecha;
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

  const tareas = await env.DB.prepare(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(Estado_Tarea = 'Asignada'), 0) AS asignadas,
            COALESCE(SUM(Estado_Tarea = 'En Progreso'), 0) AS en_progreso,
            COALESCE(SUM(Estado_Tarea = 'En revisión'), 0) AS en_revision,
            COALESCE(SUM(Estado_Tarea = 'Completada'), 0) AS completadas,
            COALESCE(SUM(Observaciones LIKE '%FUERA DE PLAZO%'), 0) AS fuera_de_plazo
     FROM Tareas WHERE Fecha BETWEEN ? AND ?${filtro}`,
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

  return json({
    periodo: { clave: periodo, ...rango },
    trabajador,
    asistencia: { ...asistencia, esperadas },
    tareas,
    eficiencia: tareas.total ? Math.round((tareas.completadas / tareas.total) * 1000) / 10 : 0,
  });
}