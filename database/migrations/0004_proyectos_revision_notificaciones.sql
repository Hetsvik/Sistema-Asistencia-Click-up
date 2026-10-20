-- Migración aditiva e idempotente. No altera IDs, PIN ni datos de las tablas existentes.
CREATE TABLE IF NOT EXISTS Proyectos_Detalle (
 ID_Proyecto INTEGER PRIMARY KEY REFERENCES Proyectos(ID_Proyecto) ON DELETE CASCADE,
 Descripcion TEXT NOT NULL DEFAULT '', Fecha_Programada TEXT,
 Fecha_Creacion TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS Tareas_Detalle (
 ID_Tarea INTEGER PRIMARY KEY REFERENCES Tareas(ID_Tarea) ON DELETE CASCADE,
 Prioridad TEXT CHECK(Prioridad IS NULL OR Prioridad IN ('Alta','Media','Baja'))
);
INSERT OR IGNORE INTO Tareas_Detalle(ID_Tarea) SELECT ID_Tarea FROM Tareas;
CREATE TABLE IF NOT EXISTS Notificaciones_Tarea (
 ID_Notificacion INTEGER PRIMARY KEY AUTOINCREMENT,
 ID_Empleado INTEGER NOT NULL REFERENCES Empleados(ID_Empleado),
 ID_Tarea INTEGER NOT NULL REFERENCES Tareas(ID_Tarea) ON DELETE CASCADE,
 Tipo TEXT NOT NULL, Nombre_Tarea TEXT NOT NULL, Descripcion TEXT NOT NULL,
 Fecha_Entrega TEXT, Estado TEXT NOT NULL, Observaciones TEXT,
 Fecha_Evento TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS IX_Notificaciones_Destino ON Notificaciones_Tarea(ID_Empleado,ID_Notificacion DESC);
CREATE TABLE IF NOT EXISTS Notificaciones_Lectura (
 ID_Empleado INTEGER PRIMARY KEY REFERENCES Empleados(ID_Empleado), Ocultas_Hasta INTEGER NOT NULL DEFAULT 0
);
-- Los triggers generan avisos en la MISMA transacción que crea o cambia la tarea.
CREATE TRIGGER IF NOT EXISTS TR_Tarea_Asignada_Aviso AFTER INSERT ON Tareas BEGIN
 INSERT OR IGNORE INTO Tareas_Detalle(ID_Tarea) VALUES(NEW.ID_Tarea);
 INSERT INTO Notificaciones_Tarea(ID_Empleado,ID_Tarea,Tipo,Nombre_Tarea,Descripcion,Fecha_Entrega,Estado)
 SELECT W.ID_Empleado,NEW.ID_Tarea,'Asignada',P.Nombre_Proyecto,NEW.Descripcion_Tarea,NEW.Fecha_Entrega,NEW.Estado_Tarea
 FROM Trabajadores W JOIN Proyectos P ON P.ID_Proyecto=NEW.ID_Proyecto WHERE W.ID_Trabajador=NEW.ID_Trabajador;
END;
CREATE TRIGGER IF NOT EXISTS TR_Tarea_Estado_Aviso AFTER UPDATE OF Estado_Tarea ON Tareas
WHEN OLD.Estado_Tarea<>NEW.Estado_Tarea BEGIN
 INSERT INTO Notificaciones_Tarea(ID_Empleado,ID_Tarea,Tipo,Nombre_Tarea,Descripcion,Fecha_Entrega,Estado,Observaciones)
 SELECT A.ID_Empleado,NEW.ID_Tarea,CASE WHEN OLD.Estado_Tarea='En revisión' AND NEW.Estado_Tarea='En Progreso' THEN 'Devuelta' ELSE NEW.Estado_Tarea END,
 P.Nombre_Proyecto,NEW.Descripcion_Tarea,NEW.Fecha_Entrega,NEW.Estado_Tarea,NEW.Observaciones
 FROM Administrador A JOIN Empleados E ON E.ID_Empleado=A.ID_Empleado
 LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado
 JOIN Proyectos P ON P.ID_Proyecto=NEW.ID_Proyecto
 WHERE E.Estado='Activo' AND COALESCE(C.Rol,'admin')='admin';
 INSERT INTO Notificaciones_Tarea(ID_Empleado,ID_Tarea,Tipo,Nombre_Tarea,Descripcion,Fecha_Entrega,Estado,Observaciones)
 SELECT W.ID_Empleado,NEW.ID_Tarea,CASE WHEN OLD.Estado_Tarea='En revisión' AND NEW.Estado_Tarea='En Progreso' THEN 'Devuelta' ELSE NEW.Estado_Tarea END,
 P.Nombre_Proyecto,NEW.Descripcion_Tarea,NEW.Fecha_Entrega,NEW.Estado_Tarea,NEW.Observaciones
 FROM Trabajadores W JOIN Proyectos P ON P.ID_Proyecto=NEW.ID_Proyecto
 WHERE W.ID_Trabajador=NEW.ID_Trabajador AND (NEW.Estado_Tarea='Completada' OR (OLD.Estado_Tarea IN ('En revisión','Completada') AND NEW.Estado_Tarea='En Progreso'));
END;
