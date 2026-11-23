-- Sustituye proyectos por nombres propios de tarea y conserva los nombres actuales.
-- Requiere SQLite con ALTER TABLE ... RENAME/DROP COLUMN habilitado (D1).
PRAGMA defer_foreign_keys = ON;

DROP TRIGGER IF EXISTS TR_Tarea_Asignada_Aviso;
DROP TRIGGER IF EXISTS TR_Tarea_Estado_Aviso;
DROP TRIGGER IF EXISTS TR_Tarea_Proyecto_Eliminado;
DROP TRIGGER IF EXISTS TR_Alarma_Vencimiento_Aviso;
DROP TRIGGER IF EXISTS TR_Express_Aceptar;
DROP TRIGGER IF EXISTS TR_Express_Crear_Tarea;

-- DROP TABLE activa cascadas históricas; respaldamos aquí sus tablas hijas para restaurarlas.
CREATE TABLE _Mig_Tareas_Detalle AS SELECT * FROM Tareas_Detalle;
CREATE TABLE _Mig_Comentarios_Tarea AS SELECT * FROM Comentarios_Tarea;
CREATE TABLE _Mig_Archivos AS SELECT * FROM Archivos;
CREATE TABLE _Mig_Notificaciones_Tarea AS SELECT * FROM Notificaciones_Tarea;
CREATE TABLE _Mig_Alarmas_Vencimiento AS SELECT * FROM Alarmas_Vencimiento;
CREATE TABLE _Mig_Tareas_Control AS SELECT * FROM Tareas_Control;

CREATE TABLE Tareas_Sin_Proyecto (
 ID_Tarea INTEGER PRIMARY KEY AUTOINCREMENT,
 ID_Trabajador INTEGER NOT NULL,
 ID_Administrador_Asignador INTEGER NOT NULL,
 Nombre_Tarea TEXT NOT NULL DEFAULT 'Tarea',
 Fecha TEXT NOT NULL DEFAULT (DATE('now')),
 Fecha_Inicio TEXT,
 Fecha_Entrega TEXT,
 Descripcion_Tarea TEXT NOT NULL,
 Estado_Tarea TEXT NOT NULL DEFAULT 'Asignada',
 Observaciones TEXT,
 FOREIGN KEY (ID_Trabajador) REFERENCES Trabajadores(ID_Trabajador),
 FOREIGN KEY (ID_Administrador_Asignador) REFERENCES Administrador(ID_Administrador)
);
INSERT INTO Tareas_Sin_Proyecto
 (ID_Tarea,ID_Trabajador,ID_Administrador_Asignador,Nombre_Tarea,Fecha,Fecha_Inicio,Fecha_Entrega,Descripcion_Tarea,Estado_Tarea,Observaciones)
 SELECT T.ID_Tarea,T.ID_Trabajador,T.ID_Administrador_Asignador,COALESCE(NULLIF(P.Nombre_Proyecto,''),'Tarea'),T.Fecha,T.Fecha_Inicio,T.Fecha_Entrega,T.Descripcion_Tarea,T.Estado_Tarea,T.Observaciones
 FROM Tareas T LEFT JOIN Proyectos P ON P.ID_Proyecto=T.ID_Proyecto;
DROP TABLE Tareas;
ALTER TABLE Tareas_Sin_Proyecto RENAME TO Tareas;
CREATE INDEX IF NOT EXISTS FK_Tareas_Administrador ON Tareas(ID_Administrador_Asignador);
CREATE INDEX IF NOT EXISTS IX_Tareas_Busqueda ON Tareas(ID_Trabajador, Fecha);
CREATE INDEX IF NOT EXISTS IX_Tareas_Estado_Entrega ON Tareas(Estado_Tarea, Fecha_Entrega);
CREATE INDEX IF NOT EXISTS IX_Tareas_Entrega_Id ON Tareas(Fecha_Entrega,ID_Tarea);
CREATE INDEX IF NOT EXISTS IX_Tareas_Trabajador_Entrega_Id ON Tareas(ID_Trabajador,Fecha_Entrega,ID_Tarea);
CREATE INDEX IF NOT EXISTS IX_Tareas_Fecha_Trabajador ON Tareas(Fecha,ID_Trabajador);
INSERT INTO Tareas_Detalle(ID_Tarea,Prioridad) SELECT ID_Tarea,Prioridad FROM _Mig_Tareas_Detalle;
INSERT INTO Comentarios_Tarea(ID_Comentario,ID_Tarea,Autor,Rol,Mensaje,Fecha) SELECT ID_Comentario,ID_Tarea,Autor,Rol,Mensaje,Fecha FROM _Mig_Comentarios_Tarea;
INSERT INTO Archivos(ID_Archivo,ID_Trabajador,ID_Tarea,ID_Actividad,Nombre_Original,Nombre_Almacenado,Tipo_Archivo,Tamano_Archivo,GoogleDrive_File_ID,Ruta_GoogleDrive,Fecha_Subida,Estado)
 SELECT ID_Archivo,ID_Trabajador,ID_Tarea,ID_Actividad,Nombre_Original,Nombre_Almacenado,Tipo_Archivo,Tamano_Archivo,GoogleDrive_File_ID,Ruta_GoogleDrive,Fecha_Subida,Estado FROM _Mig_Archivos;
INSERT INTO Notificaciones_Tarea(ID_Notificacion,ID_Empleado,ID_Tarea,Tipo,Nombre_Tarea,Descripcion,Fecha_Entrega,Estado,Observaciones,Fecha_Evento)
 SELECT ID_Notificacion,ID_Empleado,ID_Tarea,Tipo,Nombre_Tarea,Descripcion,Fecha_Entrega,Estado,Observaciones,Fecha_Evento FROM _Mig_Notificaciones_Tarea;
INSERT INTO Alarmas_Vencimiento(ID_Tarea,Fecha_Entrega,Minutos,ID_Empleado) SELECT ID_Tarea,Fecha_Entrega,Minutos,ID_Empleado FROM _Mig_Alarmas_Vencimiento;
INSERT INTO Tareas_Control(ID_Tarea,Eliminada_En,Eliminada_Por) SELECT ID_Tarea,Eliminada_En,Eliminada_Por FROM _Mig_Tareas_Control;
UPDATE Notificaciones_Tarea SET Nombre_Tarea=(SELECT Nombre_Tarea FROM Tareas WHERE Tareas.ID_Tarea=Notificaciones_Tarea.ID_Tarea);
DROP TABLE _Mig_Tareas_Detalle;
DROP TABLE _Mig_Comentarios_Tarea;
DROP TABLE _Mig_Archivos;
DROP TABLE _Mig_Notificaciones_Tarea;
DROP TABLE _Mig_Alarmas_Vencimiento;
DROP TABLE _Mig_Tareas_Control;

CREATE TABLE Tareas_Express_Sin_Proyecto (
 ID INTEGER PRIMARY KEY AUTOINCREMENT,
 Clave TEXT NOT NULL UNIQUE,
 Nombre_Tarea TEXT NOT NULL DEFAULT 'Tarea express',
 ID_Administrador INTEGER NOT NULL REFERENCES Administrador(ID_Administrador),
 Descripcion TEXT NOT NULL,
 Prioridad TEXT NOT NULL CHECK(Prioridad IN ('Alta','Media','Baja')),
 Fecha_Entrega TEXT NOT NULL,
 Cupos INTEGER NOT NULL CHECK(Cupos BETWEEN 1 AND 50),
 Cancelada INTEGER NOT NULL DEFAULT 0 CHECK(Cancelada IN (0,1)),
 Creada_En TEXT NOT NULL
);
INSERT INTO Tareas_Express_Sin_Proyecto
 (ID,Clave,Nombre_Tarea,ID_Administrador,Descripcion,Prioridad,Fecha_Entrega,Cupos,Cancelada,Creada_En)
 SELECT X.ID,X.Clave,COALESCE(NULLIF(P.Nombre_Proyecto,''),'Tarea express'),X.ID_Administrador,X.Descripcion,X.Prioridad,X.Fecha_Entrega,X.Cupos,X.Cancelada,X.Creada_En
 FROM Tareas_Express X LEFT JOIN Proyectos P ON P.ID_Proyecto=X.ID_Proyecto;
DROP TABLE Tareas_Express;
ALTER TABLE Tareas_Express_Sin_Proyecto RENAME TO Tareas_Express;

DROP TABLE IF EXISTS Proyectos_Control;
DROP TABLE IF EXISTS Proyectos_Detalle;
DROP TABLE IF EXISTS Proyectos;

CREATE TRIGGER TR_Tarea_Asignada_Aviso AFTER INSERT ON Tareas BEGIN
 INSERT OR IGNORE INTO Tareas_Detalle(ID_Tarea) VALUES(NEW.ID_Tarea);
 INSERT INTO Notificaciones_Tarea(ID_Empleado,ID_Tarea,Tipo,Nombre_Tarea,Descripcion,Fecha_Entrega,Estado)
 SELECT W.ID_Empleado,NEW.ID_Tarea,'Asignada',NEW.Nombre_Tarea,NEW.Descripcion_Tarea,NEW.Fecha_Entrega,NEW.Estado_Tarea
 FROM Trabajadores W WHERE W.ID_Trabajador=NEW.ID_Trabajador;
END;
CREATE TRIGGER TR_Tarea_Estado_Aviso AFTER UPDATE OF Estado_Tarea ON Tareas
WHEN OLD.Estado_Tarea<>NEW.Estado_Tarea BEGIN
 INSERT INTO Notificaciones_Tarea(ID_Empleado,ID_Tarea,Tipo,Nombre_Tarea,Descripcion,Fecha_Entrega,Estado,Observaciones)
 SELECT A.ID_Empleado,NEW.ID_Tarea,CASE WHEN OLD.Estado_Tarea='En revisión' AND NEW.Estado_Tarea='En Progreso' THEN 'Devuelta' ELSE NEW.Estado_Tarea END,
 NEW.Nombre_Tarea,NEW.Descripcion_Tarea,NEW.Fecha_Entrega,NEW.Estado_Tarea,NEW.Observaciones
 FROM Administrador A JOIN Empleados E ON E.ID_Empleado=A.ID_Empleado LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado
 WHERE E.Estado='Activo' AND COALESCE(C.Rol,'admin')='admin';
 INSERT INTO Notificaciones_Tarea(ID_Empleado,ID_Tarea,Tipo,Nombre_Tarea,Descripcion,Fecha_Entrega,Estado,Observaciones)
 SELECT W.ID_Empleado,NEW.ID_Tarea,CASE WHEN OLD.Estado_Tarea='En revisión' AND NEW.Estado_Tarea='En Progreso' THEN 'Devuelta' ELSE NEW.Estado_Tarea END,
 NEW.Nombre_Tarea,NEW.Descripcion_Tarea,NEW.Fecha_Entrega,NEW.Estado_Tarea,NEW.Observaciones
 FROM Trabajadores W WHERE W.ID_Trabajador=NEW.ID_Trabajador AND (NEW.Estado_Tarea='Completada' OR (OLD.Estado_Tarea IN ('En revisión','Completada') AND NEW.Estado_Tarea='En Progreso'));
END;
CREATE TRIGGER TR_Alarma_Vencimiento_Aviso AFTER INSERT ON Alarmas_Vencimiento BEGIN
 INSERT INTO Notificaciones_Tarea(ID_Empleado,ID_Tarea,Tipo,Nombre_Tarea,Descripcion,Fecha_Entrega,Estado)
 SELECT NEW.ID_Empleado,T.ID_Tarea,'Vencimiento:' || NEW.Minutos,T.Nombre_Tarea,T.Descripcion_Tarea,T.Fecha_Entrega,T.Estado_Tarea
 FROM Tareas T WHERE T.ID_Tarea=NEW.ID_Tarea;
END;
CREATE TRIGGER TR_Express_Aceptar BEFORE INSERT ON Tareas_Express_Aceptaciones BEGIN
 SELECT CASE WHEN NOT EXISTS(
  SELECT 1 FROM Tareas_Express X JOIN Tareas_Express_Areas XA ON XA.ID_Express=X.ID JOIN Empleados_Area EA ON EA.ID_Area=XA.ID_Area JOIN Empleados E ON E.ID_Empleado=EA.ID_Empleado JOIN Trabajadores W ON W.ID_Empleado=E.ID_Empleado LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado
  WHERE X.ID=NEW.ID_Express AND E.ID_Empleado=NEW.ID_Empleado AND E.Estado='Activo' AND COALESCE(C.Rol,CASE WHEN EXISTS(SELECT 1 FROM Administrador AD WHERE AD.ID_Empleado=E.ID_Empleado) THEN 'admin' ELSE 'trabajador' END)='trabajador' AND X.Cancelada=0 AND X.Fecha_Entrega>datetime('now','-5 hours') AND (SELECT COUNT(*) FROM Tareas_Express_Aceptaciones A WHERE A.ID_Express=X.ID)<X.Cupos
 ) THEN RAISE(ABORT,'EXPRESS_NO_DISPONIBLE') END;
END;
CREATE TRIGGER TR_Express_Crear_Tarea AFTER INSERT ON Tareas_Express_Aceptaciones BEGIN
 INSERT INTO Tareas(ID_Trabajador,ID_Administrador_Asignador,Nombre_Tarea,Fecha,Fecha_Inicio,Fecha_Entrega,Descripcion_Tarea,Estado_Tarea)
 SELECT W.ID_Trabajador,X.ID_Administrador,X.Nombre_Tarea,date('now','-5 hours'),datetime('now','-5 hours'),X.Fecha_Entrega,X.Descripcion,'En Progreso' FROM Tareas_Express X JOIN Trabajadores W ON W.ID_Empleado=NEW.ID_Empleado WHERE X.ID=NEW.ID_Express;
 UPDATE Tareas_Detalle SET Prioridad=(SELECT Prioridad FROM Tareas_Express WHERE ID=NEW.ID_Express) WHERE ID_Tarea=last_insert_rowid();
 UPDATE Tareas_Express_Aceptaciones SET ID_Tarea=last_insert_rowid() WHERE ID_Express=NEW.ID_Express AND ID_Empleado=NEW.ID_Empleado;
END;
