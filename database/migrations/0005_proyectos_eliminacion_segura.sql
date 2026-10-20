-- Eliminación lógica: conserva las relaciones y el historial de tareas.
CREATE TABLE IF NOT EXISTS Proyectos_Control (
 ID_Proyecto INTEGER PRIMARY KEY REFERENCES Proyectos(ID_Proyecto) ON DELETE CASCADE,
 Eliminado_En TEXT
);
CREATE INDEX IF NOT EXISTS IX_Proyectos_Control_Eliminados ON Proyectos_Control(Eliminado_En);
-- Defensa adicional para asignaciones nuevas, incluidas integraciones antiguas.
CREATE TRIGGER IF NOT EXISTS TR_Tarea_Proyecto_Eliminado BEFORE INSERT ON Tareas
WHEN EXISTS(SELECT 1 FROM Proyectos_Control C WHERE C.ID_Proyecto=NEW.ID_Proyecto AND C.Eliminado_En IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'PROYECTO_ELIMINADO'); END;
