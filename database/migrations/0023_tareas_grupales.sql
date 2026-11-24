-- Una tarea puede tener varios trabajadores participantes. Las tareas previas
-- conservan su único destinatario como participante para mantener compatibilidad.
CREATE TABLE IF NOT EXISTS Tareas_Trabajadores (
  ID_Tarea INTEGER NOT NULL REFERENCES Tareas(ID_Tarea),
  ID_Trabajador INTEGER NOT NULL REFERENCES Trabajadores(ID_Trabajador),
  PRIMARY KEY (ID_Tarea, ID_Trabajador)
);

CREATE INDEX IF NOT EXISTS IX_Tareas_Trabajadores_Trabajador
  ON Tareas_Trabajadores(ID_Trabajador, ID_Tarea);

INSERT OR IGNORE INTO Tareas_Trabajadores(ID_Tarea, ID_Trabajador)
SELECT ID_Tarea, ID_Trabajador FROM Tareas;
