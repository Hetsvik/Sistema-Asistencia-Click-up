-- Metadatos independientes: no se modifica la tabla heredada Archivos/GoogleDrive.
CREATE TABLE IF NOT EXISTS Envios_R2 (
 ID TEXT PRIMARY KEY,
 ID_Tarea INTEGER NOT NULL REFERENCES Tareas(ID_Tarea),
 ID_Empleado INTEGER NOT NULL REFERENCES Empleados(ID_Empleado),
 Clave_Cliente TEXT NOT NULL,
 Huella TEXT NOT NULL,
 Intento TEXT NOT NULL,
 Estado TEXT NOT NULL CHECK(Estado IN ('pendiente','listo','limpieza','error')),
 Bytes INTEGER NOT NULL CHECK(Bytes>=0),
 Plan_JSON TEXT NOT NULL CHECK(json_valid(Plan_JSON)),
 ID_Comentario INTEGER REFERENCES Comentarios_Tarea(ID_Comentario),
 Creado_UTC TEXT NOT NULL,
 UNIQUE(ID_Tarea,ID_Empleado,Clave_Cliente)
);
CREATE INDEX IF NOT EXISTS IX_Envios_R2_Tarea ON Envios_R2(ID_Tarea,Estado);
CREATE INDEX IF NOT EXISTS IX_Envios_R2_Autor ON Envios_R2(ID_Empleado,Estado);
CREATE INDEX IF NOT EXISTS IX_Envios_R2_Limpieza ON Envios_R2(Estado,Creado_UTC);
CREATE TABLE IF NOT EXISTS Adjuntos_R2 (
 ID TEXT PRIMARY KEY,
 ID_Envio TEXT NOT NULL REFERENCES Envios_R2(ID),
 ID_Comentario INTEGER NOT NULL REFERENCES Comentarios_Tarea(ID_Comentario),
 Nombre TEXT NOT NULL,
 MIME TEXT NOT NULL,
 Bytes INTEGER NOT NULL CHECK(Bytes>0),
 Clave_Objeto TEXT NOT NULL UNIQUE,
 Creado_UTC TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS IX_Adjuntos_R2_Comentario ON Adjuntos_R2(ID_Comentario);
