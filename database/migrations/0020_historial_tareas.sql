-- Registra la fecha local de finalización para consultar tareas completadas por intervalo.
ALTER TABLE Tareas ADD COLUMN Fecha_Completada TEXT;
CREATE INDEX IF NOT EXISTS IX_Tareas_Historial ON Tareas(Estado_Tarea,Fecha_Completada,ID_Tarea);
