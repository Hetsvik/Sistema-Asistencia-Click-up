-- Horario semanal opcional. No modifica empleados, credenciales ni asistencias.
CREATE TABLE IF NOT EXISTS Horarios_Laborales (
 ID_Empleado INTEGER PRIMARY KEY REFERENCES Empleados(ID_Empleado) ON DELETE CASCADE,
 Horario_JSON TEXT NOT NULL CHECK(json_valid(Horario_JSON)),
 Actualizado_En TEXT NOT NULL
);
