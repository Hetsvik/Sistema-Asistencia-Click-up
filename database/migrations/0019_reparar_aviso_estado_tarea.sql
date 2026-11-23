-- Repara instalaciones que conservaron el trigger anterior, el cual intentaba
-- consultar Proyectos al cambiar el estado de una tarea.
DROP TRIGGER IF EXISTS TR_Tarea_Estado_Aviso;

CREATE TRIGGER TR_Tarea_Estado_Aviso AFTER UPDATE OF Estado_Tarea ON Tareas
WHEN OLD.Estado_Tarea<>NEW.Estado_Tarea BEGIN
 INSERT INTO Notificaciones_Tarea(ID_Empleado,ID_Tarea,Tipo,Nombre_Tarea,Descripcion,Fecha_Entrega,Estado,Observaciones)
 SELECT A.ID_Empleado,NEW.ID_Tarea,
 CASE WHEN OLD.Estado_Tarea='En revisión' AND NEW.Estado_Tarea='En Progreso' THEN 'Devuelta' ELSE NEW.Estado_Tarea END,
 NEW.Nombre_Tarea,NEW.Descripcion_Tarea,NEW.Fecha_Entrega,NEW.Estado_Tarea,NEW.Observaciones
 FROM Administrador A
 JOIN Empleados E ON E.ID_Empleado=A.ID_Empleado
 LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado
 WHERE E.Estado='Activo' AND COALESCE(C.Rol,'admin')='admin';

 INSERT INTO Notificaciones_Tarea(ID_Empleado,ID_Tarea,Tipo,Nombre_Tarea,Descripcion,Fecha_Entrega,Estado,Observaciones)
 SELECT W.ID_Empleado,NEW.ID_Tarea,
 CASE WHEN OLD.Estado_Tarea='En revisión' AND NEW.Estado_Tarea='En Progreso' THEN 'Devuelta' ELSE NEW.Estado_Tarea END,
 NEW.Nombre_Tarea,NEW.Descripcion_Tarea,NEW.Fecha_Entrega,NEW.Estado_Tarea,NEW.Observaciones
 FROM Trabajadores W
 WHERE W.ID_Trabajador=NEW.ID_Trabajador
 AND (NEW.Estado_Tarea='Completada' OR (OLD.Estado_Tarea IN ('En revisión','Completada') AND NEW.Estado_Tarea='En Progreso'));
END;
