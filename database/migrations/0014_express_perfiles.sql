-- No altera tareas, usuarios ni archivos existentes. Las áreas se crean en 0013.
CREATE TABLE IF NOT EXISTS Tareas_Express (
 ID INTEGER PRIMARY KEY AUTOINCREMENT, Clave TEXT NOT NULL UNIQUE,
 ID_Proyecto INTEGER NOT NULL REFERENCES Proyectos(ID_Proyecto),
 ID_Administrador INTEGER NOT NULL REFERENCES Administrador(ID_Administrador),
 Descripcion TEXT NOT NULL, Prioridad TEXT NOT NULL CHECK(Prioridad IN ('Alta','Media','Baja')),
 Fecha_Entrega TEXT NOT NULL, Cupos INTEGER NOT NULL CHECK(Cupos BETWEEN 1 AND 50),
 Cancelada INTEGER NOT NULL DEFAULT 0 CHECK(Cancelada IN (0,1)), Creada_En TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS Tareas_Express_Areas (
 ID_Express INTEGER NOT NULL REFERENCES Tareas_Express(ID), ID_Area INTEGER NOT NULL REFERENCES Areas_Trabajo(ID_Area),
 PRIMARY KEY(ID_Express,ID_Area)
);
CREATE TABLE IF NOT EXISTS Tareas_Express_Aceptaciones (
 ID_Express INTEGER NOT NULL REFERENCES Tareas_Express(ID), ID_Empleado INTEGER NOT NULL REFERENCES Empleados(ID_Empleado),
 ID_Tarea INTEGER REFERENCES Tareas(ID_Tarea), PRIMARY KEY(ID_Express,ID_Empleado), UNIQUE(ID_Tarea)
);
CREATE TRIGGER IF NOT EXISTS TR_Express_Aceptar BEFORE INSERT ON Tareas_Express_Aceptaciones BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM Tareas_Express X JOIN Tareas_Express_Areas XA ON XA.ID_Express=X.ID JOIN Empleados_Area EA ON EA.ID_Area=XA.ID_Area JOIN Empleados E ON E.ID_Empleado=EA.ID_Empleado JOIN Trabajadores W ON W.ID_Empleado=E.ID_Empleado LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado WHERE X.ID=NEW.ID_Express AND E.ID_Empleado=NEW.ID_Empleado AND E.Estado='Activo' AND COALESCE(C.Rol,CASE WHEN EXISTS(SELECT 1 FROM Administrador AD WHERE AD.ID_Empleado=E.ID_Empleado) THEN 'admin' ELSE 'trabajador' END)='trabajador' AND X.Cancelada=0 AND X.Fecha_Entrega>datetime('now','-5 hours') AND NOT EXISTS(SELECT 1 FROM Proyectos_Control PC WHERE PC.ID_Proyecto=X.ID_Proyecto AND PC.Eliminado_En IS NOT NULL) AND (SELECT COUNT(*) FROM Tareas_Express_Aceptaciones A WHERE A.ID_Express=X.ID)<X.Cupos) THEN RAISE(ABORT,'EXPRESS_NO_DISPONIBLE') END;
END;
CREATE TRIGGER IF NOT EXISTS TR_Express_Crear_Tarea AFTER INSERT ON Tareas_Express_Aceptaciones BEGIN
 INSERT INTO Tareas(ID_Trabajador,ID_Administrador_Asignador,ID_Proyecto,Fecha,Fecha_Inicio,Fecha_Entrega,Descripcion_Tarea,Estado_Tarea)
 SELECT W.ID_Trabajador,X.ID_Administrador,X.ID_Proyecto,date('now','-5 hours'),datetime('now','-5 hours'),X.Fecha_Entrega,X.Descripcion,'En Progreso' FROM Tareas_Express X JOIN Trabajadores W ON W.ID_Empleado=NEW.ID_Empleado WHERE X.ID=NEW.ID_Express;
 UPDATE Tareas_Detalle SET Prioridad=(SELECT Prioridad FROM Tareas_Express WHERE ID=NEW.ID_Express) WHERE ID_Tarea=last_insert_rowid();
 UPDATE Tareas_Express_Aceptaciones SET ID_Tarea=last_insert_rowid() WHERE ID_Express=NEW.ID_Express AND ID_Empleado=NEW.ID_Empleado;
END;
CREATE TABLE IF NOT EXISTS Fotos_Usuario (ID_Empleado INTEGER PRIMARY KEY REFERENCES Empleados(ID_Empleado),Clave_Objeto TEXT NOT NULL UNIQUE,Actualizada_UTC TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS Fotos_Eliminacion (Clave_Objeto TEXT PRIMARY KEY,Creada_UTC TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS Empleados_Cargo (ID_Empleado INTEGER PRIMARY KEY REFERENCES Empleados(ID_Empleado), Cargo TEXT NOT NULL);
