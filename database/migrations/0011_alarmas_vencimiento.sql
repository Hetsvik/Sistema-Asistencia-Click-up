-- El identificador único impide duplicados entre invocaciones concurrentes.
CREATE TABLE IF NOT EXISTS Alarmas_Vencimiento (
 ID_Tarea INTEGER NOT NULL REFERENCES Tareas(ID_Tarea) ON DELETE CASCADE,
 Fecha_Entrega TEXT NOT NULL,
 Minutos INTEGER NOT NULL CHECK(Minutos IN (1,5,10,30,60)),
 ID_Empleado INTEGER NOT NULL REFERENCES Empleados(ID_Empleado),
 PRIMARY KEY(ID_Tarea,Fecha_Entrega,Minutos)
);
CREATE TRIGGER IF NOT EXISTS TR_Alarma_Vencimiento_Aviso
AFTER INSERT ON Alarmas_Vencimiento BEGIN
 INSERT INTO Notificaciones_Tarea(ID_Empleado,ID_Tarea,Tipo,Nombre_Tarea,Descripcion,Fecha_Entrega,Estado)
 SELECT NEW.ID_Empleado,T.ID_Tarea,'Vencimiento:' || NEW.Minutos,P.Nombre_Proyecto,T.Descripcion_Tarea,T.Fecha_Entrega,T.Estado_Tarea
 FROM Tareas T JOIN Proyectos P ON P.ID_Proyecto=T.ID_Proyecto WHERE T.ID_Tarea=NEW.ID_Tarea;
END;
