-- Migración 0002 · bloqueo temporal de login (anti fuerza bruta) e índices de consulta.

CREATE TABLE IF NOT EXISTS Intentos_Login (
  Clave TEXT PRIMARY KEY,                 -- rol:codigo|ip
  Intentos INTEGER NOT NULL DEFAULT 0,
  Bloqueado_Hasta INTEGER NOT NULL DEFAULT 0, -- epoch en milisegundos
  Actualizado INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS IX_Asistencia_Fecha ON Asistencia(Fecha_Calculada);
CREATE INDEX IF NOT EXISTS IX_Tareas_Estado_Entrega ON Tareas(Estado_Tarea, Fecha_Entrega);
