import { nowLocal } from './dates.js';
// Una inserción por lote y por minuto. El trigger guarda el aviso en la misma transacción.
export async function generateDeadlineAlarms(db, scheduledTime, tz='America/Lima') {
 const when=nowLocal(tz,new Date(scheduledTime)).fechaHora;
 return db.prepare(`WITH umbrales(minutos) AS (VALUES(60),(30),(10),(5),(1))
 INSERT OR IGNORE INTO Alarmas_Vencimiento(ID_Tarea,Fecha_Entrega,Minutos,ID_Empleado)
 SELECT T.ID_Tarea,T.Fecha_Entrega,U.minutos,W.ID_Empleado
 FROM Tareas T JOIN Trabajadores W ON W.ID_Trabajador=T.ID_Trabajador
 JOIN Empleados E ON E.ID_Empleado=W.ID_Empleado
 LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado CROSS JOIN umbrales U
 WHERE T.Estado_Tarea IN ('Asignada','En Progreso') AND E.Estado='Activo' AND COALESCE(C.Rol,'trabajador')='trabajador'
 AND T.Fecha_Entrega >= ? AND T.Fecha_Entrega <= datetime(?, '+60 minutes')
 AND datetime(T.Fecha_Entrega, '-' || U.minutos || ' minutes') <= ?
 AND datetime(T.Fecha_Entrega, '-' || U.minutos || ' minutes') > datetime(?, '-1 minute')
 `).bind(when,when,when,when).run();
}
