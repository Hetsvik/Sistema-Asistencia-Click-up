import {HttpError} from './http.js';
/** Proyección SQL de los tramos: vigencia por intervalo, pausas y plan congelado.
 * No devuelve a JavaScript todos los trabajadores × fechas para después recortarlos.
 * El momento de evaluación llega del reloj del servidor en hora de Perú.
 */
export function attendanceCTE({desde,hasta,workerId=null,q='',now}){
 const scope=workerId?'WHERE T.ID_Trabajador=?':q?'WHERE E.Nombre_Completo LIKE ?':'';
 const args=[desde,hasta<now.fecha?hasta:now.fecha,now.fechaHora,...(workerId?[workerId]:q?['%'+q+'%']:[])];
 const sql=`WITH RECURSIVE
 bounds AS (SELECT ? lo,? hi,? clock),
 workers AS (SELECT T.ID_Trabajador trabajador_id,T.ID_Empleado empleado_id,E.Nombre_Completo nombre FROM Trabajadores T JOIN Empleados E ON E.ID_Empleado=T.ID_Empleado ${scope}),
 versions AS (SELECT V.ID_Empleado,V.Desde,V.Horario_JSON,LEAD(V.Desde) OVER(PARTITION BY V.ID_Empleado ORDER BY V.Desde) next FROM Horarios_Vigencia V JOIN workers W ON W.empleado_id=V.ID_Empleado),
 intervals AS (SELECT W.trabajador_id,W.nombre,V.Horario_JSON,MAX(V.Desde,B.lo) first,MIN(COALESCE(date(V.next,'-1 day'),B.hi),B.hi) last FROM versions V JOIN workers W ON W.empleado_id=V.ID_Empleado CROSS JOIN bounds B WHERE json_array_length(V.Horario_JSON)>0),
 days(trabajador_id,nombre,horario,fecha,last) AS (
 SELECT trabajador_id,nombre,Horario_JSON,first,last FROM intervals WHERE first<=last
 UNION ALL SELECT trabajador_id,nombre,horario,date(fecha,'+1 day'),last FROM days WHERE fecha<last),
 saved AS (SELECT M.ID_Trabajador trabajador_id,W.nombre,M.Fecha fecha,M.Tramo tramo,M.Inicio_Previsto inicio,M.Fin_Previsto fin,M.Entrada entrada,M.Salida salida FROM Marcaciones_Tramo M JOIN workers W ON W.trabajador_id=M.ID_Trabajador CROSS JOIN bounds B WHERE M.Fecha BETWEEN B.lo AND B.hi),
 planned AS (SELECT D.trabajador_id,D.nombre,D.fecha,CAST(S.key AS INTEGER)+1 tramo,json_extract(S.value,'$.inicio') inicio,json_extract(S.value,'$.fin') fin,NULL entrada,NULL salida FROM days D,json_each(D.horario) J,json_each(J.value,'$.tramos') S WHERE json_extract(J.value,'$.dia')=((CAST(strftime('%w',D.fecha) AS INTEGER)+6)%7)+1),
 slots AS (SELECT * FROM saved UNION ALL SELECT P.* FROM planned P WHERE NOT EXISTS(SELECT 1 FROM saved S WHERE S.trabajador_id=P.trabajador_id AND S.fecha=P.fecha AND S.tramo=P.tramo)),
 evaluated AS (SELECT S.*,datetime(fecha||' '||inicio||':00','+10 minutes') deadline,(entrada IS NOT NULL OR B.clock>datetime(fecha||' '||inicio||':00','+10 minutes')) evaluado,(entrada IS NOT NULL AND entrada<=datetime(fecha||' '||inicio||':00','+10 minutes')) puntual,(COALESCE(entrada,B.clock)>datetime(fecha||' '||inicio||':00','+10 minutes')) falta FROM slots S CROSS JOIN bounds B)
 `;
 return {sql,args};
}
export async function guardAttendance(db,query){
 // Acota trabajo de calendario incluso si el cliente pide todo el historial.
 const row=await db.prepare(query.sql+"SELECT COALESCE(SUM((julianday(last)-julianday(first)+1)*2),0) n FROM intervals WHERE first<=last").bind(...query.args).first();
 if(row.n>200000)throw new HttpError(413,'El intervalo de asistencia es demasiado amplio. Selecciona un trabajador o un periodo menor.');
}
