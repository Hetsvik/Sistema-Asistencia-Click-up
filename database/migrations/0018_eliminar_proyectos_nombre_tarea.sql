-- Sustituye Proyectos por un nombre propio en cada tarea. Conserva tareas,
-- comentarios, adjuntos, avisos y aceptaciones express existentes.
PRAGMA foreign_keys=OFF;
BEGIN;

DROP TRIGGER IF EXISTS TR_Tarea_Proyecto_Eliminado;
DROP TRIGGER IF EXISTS TR_Tarea_Asignada_Aviso;
DROP TRIGGER IF EXISTS TR_Tarea_Estado_Aviso;
DROP TRIGGER IF EXISTS TR_Alarma_Vencimiento_Aviso;
DROP TRIGGER IF EXISTS TR_Express_Aceptar;
DROP TRIGGER IF EXISTS TR_Express_Crear_Tarea;

CREATE TABLE Tareas_Nueva (
 ID_Tarea INTEGER PRIMARY KEY AUTOINCREMENT,
 ID_Trabajador INTEGER NOT NULL REFERENCES Trabajadores(ID_Trabajador),
 ID_Administrador_Asignador INTEGER NOT NULL REFERENCES Administrador(ID_Administrador),
 Fecha TEXT NOT NULL DEFAULT (DATE('now')),
 Fecha_Inicio TEXT,
 Fecha_Entrega TEXT,
 Nombre_Tarea TEXT NOT NULL,
 Descripcion_Tarea TEXT NOT NULL,
 Estado_Tarea TEXT NOT NULL DEFAULT 'Asignada',
 Observaciones TEXT
);
INSERT INTO Tareas_Nueva(ID_Tarea,ID_Trabajador,ID_Administrador_Asignador,Fecha,Fecha_Inicio,Fecha_Entrega,Nombre_Tarea,Descripcion_Tarea,Estado_Tarea,Observaciones)
SELECT T.ID_Tarea,T.ID_Trabajador,T.ID_Administrador_Asignador,T.Fecha,T.Fecha_Inicio,T.Fecha_Entrega,
 COALESCE(P.Nombre_Proyecto,'Tarea ' || T.ID_Tarea),T.Descripcion_Tarea,T.Estado_Tarea,T.Observaciones
FROM Tareas T LEFT JOIN Proyectos P ON P.ID_Proyecto=T.ID_Proyecto;
DROP TABLE Tareas;
ALTER TABLE Tareas_Nueva RENAME TO Tareas;
CREATE INDEX IX_Tareas_Busqueda ON Tareas(ID_Trabajador,Fecha);
CREATE INDEX FK_Tareas_Administrador ON Tareas(ID_Administrador_Asignador);

CREATE TABLE Tareas_Express_Nueva (
 ID INTEGER PRIMARY KEY AUTOINCREMENT,
 Clave TEXT NOT NULL UNIQUE,
 Nombre_Tarea TEXT NOT NULL,
 ID_Administrador INTEGER NOT NULL REFERENCES Administrador(ID_Administrador),
 Descripcion TEXT NOT NULL,
 Prioridad TEXT NOT NULL CHECK(Prioridad IN ('Alta','Media','Baja')),
 Fecha_Entrega TEXT NOT NULL,
 Cupos INTEGER NOT NULL CHECK(Cupos BETWEEN 1 AND 50),
 Cancelada INTEGER NOT NULL DEFAULT 0 CHECK(Cancelada IN (0,1)),
 Creada_En TEXT NOT NULL
);
INSERT INTO Tareas_Express_Nueva(ID,Clave,Nombre_Tarea,ID_Administrador,Descripcion,Prioridad,Fecha_Entrega,Cupos,Cancelada,Creada_En)
SELECT X.ID,X.Clave,COALESCE(P.Nombre_Proyecto,'Tarea express ' || X.ID),X.ID_Administrador,X.Descripcion,X.Prioridad,X.Fecha_Entrega,X.Cupos,X.Cancelada,X.Creada_En
FROM Tareas_Express X LEFT JOIN Proyectos P ON P.ID_Proyecto=X.ID_Proyecto;
DROP TABLE Tareas_Express;
ALTER TABLE Tareas_Express_Nueva RENAME TO Tareas_Express;

DROP TABLE Proyectos_Detalle;
DROP TABLE Proyectos_Control;
DROP TABLE Proyectos;

CREATE TRIGGER TR_Tarea_Asignada_Aviso AFTER INSERT ON Tareas BEGIN
 INSERT OR IGNORE INTO Tareas_Detalle(ID_Tarea) VALUES(NEW.ID_Tarea);
 INSERT INTO Notificaciones_Tarea(ID_Empleado,ID_Tarea,Tipo,Nombre_Tarea,Descripcion,Fecha_Entrega,Estado)
 SELECT W.ID_Empleado,NEW.ID_Tarea,'Asignada',NEW.Nombre_Tarea,NEW.Descripcion_Tarea,NEW.Fecha_Entrega,NEW.Estado_Tarea
 FROM Trabajadores W WHERE W.ID_Trabajador=NEW.ID_Trabajador;
END;
CREATE TRIGGER TR_Tarea_Estado_Aviso AFTER UPDATE OF Estado_Tarea ON Tareas
WHEN OLD.Estado_Tarea<>NEW.Estado_Tarea BEGIN
 INSERT INTO Notificaciones_Tarea(ID_Empleado,ID_Tarea,Tipo,Nombre_Tarea,Descripcion,Fecha_Entrega,Estado,Observaciones)
 SELECT A.ID_Empleado,NEW.ID_Tarea,CASE WHEN OLD.Estado_Tarea='En revisión' AND NEW.Estado_Tarea='En Progreso' THEN 'Devuelta' ELSE NEW.Estado_Tarea END,NEW.Nombre_Tarea,NEW.Descripcion_Tarea,NEW.Fecha_Entrega,NEW.Estado_Tarea,NEW.Observaciones
 FROM Administrador A JOIN Empleados E ON E.ID_Empleado=A.ID_Empleado LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado
 WHERE E.Estado='Activo' AND COALESCE(C.Rol,'admin')='admin';
 INSERT INTO Notificaciones_Tarea(ID_Empleado,ID_Tarea,Tipo,Nombre_Tarea,Descripcion,Fecha_Entrega,Estado,Observaciones)
 SELECT W.ID_Empleado,NEW.ID_Tarea,CASE WHEN OLD.Estado_Tarea='En revisión' AND NEW.Estado_Tarea='En Progreso' THEN 'Devuelta' ELSE NEW.Estado_Tarea END,NEW.Nombre_Tarea,NEW.Descripcion_Tarea,NEW.Fecha_Entrega,NEW.Estado_Tarea,NEW.Observaciones
 FROM Trabajadores W WHERE W.ID_Trabajador=NEW.ID_Trabajador AND (NEW.Estado_Tarea='Completada' OR (OLD.Estado_Tarea IN ('En revisión','Completada') AND NEW.Estado_Tarea='En Progreso'));
END;
CREATE TRIGGER TR_Alarma_Vencimiento_Aviso AFTER INSERT ON Alarmas_Vencimiento BEGIN
 INSERT INTO Notificaciones_Tarea(ID_Empleado,ID_Tarea,Tipo,Nombre_Tarea,Descripcion,Fecha_Entrega,Estado)
 SELECT NEW.ID_Empleado,T.ID_Tarea,'Vencimiento:' || NEW.Minutos,T.Nombre_Tarea,T.Descripcion_Tarea,T.Fecha_Entrega,T.Estado_Tarea FROM Tareas T WHERE T.ID_Tarea=NEW.ID_Tarea;
END;
CREATE TRIGGER TR_Express_Aceptar BEFORE INSERT ON Tareas_Express_Aceptaciones BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM Tareas_Express X JOIN Tareas_Express_Areas XA ON XA.ID_Express=X.ID JOIN Empleados_Area EA ON EA.ID_Area=XA.ID_Area JOIN Empleados E ON E.ID_Empleado=EA.ID_Empleado JOIN Trabajadores W ON W.ID_Empleado=E.ID_Empleado LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado WHERE X.ID=NEW.ID_Express AND E.ID_Empleado=NEW.ID_Empleado AND E.Estado='Activo' AND COALESCE(C.Rol,CASE WHEN EXISTS(SELECT 1 FROM Administrador AD WHERE AD.ID_Empleado=E.ID_Empleado) THEN 'admin' ELSE 'trabajador' END)='trabajador' AND X.Cancelada=0 AND X.Fecha_Entrega>datetime('now','-5 hours') AND (SELECT COUNT(*) FROM Tareas_Express_Aceptaciones A WHERE A.ID_Express=X.ID)<X.Cupos) THEN RAISE(ABORT,'EXPRESS_NO_DISPONIBLE') END;
END;
CREATE TRIGGER TR_Express_Crear_Tarea AFTER INSERT ON Tareas_Express_Aceptaciones BEGIN
 INSERT INTO Tareas(ID_Trabajador,ID_Administrador_Asignador,Fecha,Fecha_Inicio,Fecha_Entrega,Nombre_Tarea,Descripcion_Tarea,Estado_Tarea)
 SELECT W.ID_Trabajador,X.ID_Administrador,date('now','-5 hours'),datetime('now','-5 hours'),X.Fecha_Entrega,X.Nombre_Tarea,X.Descripcion,'En Progreso' FROM Tareas_Express X JOIN Trabajadores W ON W.ID_Empleado=NEW.ID_Empleado WHERE X.ID=NEW.ID_Express;
 UPDATE Tareas_Detalle SET Prioridad=(SELECT Prioridad FROM Tareas_Express WHERE ID=NEW.ID_Express) WHERE ID_Tarea=last_insert_rowid();
 UPDATE Tareas_Express_Aceptaciones SET ID_Tarea=last_insert_rowid() WHERE ID_Express=NEW.ID_Express AND ID_Empleado=NEW.ID_Empleado;
END;

COMMIT;
PRAGMA foreign_keys=ON;
