-- Eliminación lógica: conserva historial y objetos privados hasta definir su retención.
CREATE TABLE IF NOT EXISTS Tareas_Control (
 ID_Tarea INTEGER PRIMARY KEY REFERENCES Tareas(ID_Tarea) ON DELETE CASCADE,
 Eliminada_En TEXT NOT NULL,
 Eliminada_Por INTEGER NOT NULL REFERENCES Empleados(ID_Empleado)
);
