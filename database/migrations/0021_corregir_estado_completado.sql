-- Corrección aislada para el cambio de estado de tareas.
-- Reemplaza cualquier trigger anterior que aún dependa de Proyectos u otras
-- tablas eliminadas. El aviso se registra para el trabajador de la tarea.
DROP TRIGGER IF EXISTS TR_Tarea_Estado_Aviso;

CREATE TRIGGER TR_Tarea_Estado_Aviso
AFTER UPDATE OF Estado_Tarea ON Tareas
WHEN OLD.Estado_Tarea <> NEW.Estado_Tarea
BEGIN
  INSERT INTO Notificaciones_Tarea(
    ID_Empleado, ID_Tarea, Tipo, Nombre_Tarea, Descripcion,
    Fecha_Entrega, Estado, Observaciones
  )
  SELECT
    W.ID_Empleado,
    NEW.ID_Tarea,
    CASE
      WHEN OLD.Estado_Tarea = 'En revisión' AND NEW.Estado_Tarea = 'En Progreso' THEN 'Devuelta'
      ELSE NEW.Estado_Tarea
    END,
    NEW.Nombre_Tarea,
    NEW.Descripcion_Tarea,
    NEW.Fecha_Entrega,
    NEW.Estado_Tarea,
    NEW.Observaciones
  FROM Trabajadores W
  WHERE W.ID_Trabajador = NEW.ID_Trabajador;
END;
